import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { copyImage } from "../scripts/docker-hub-mirror.js";

const identity = {
  version: "12.0.3",
  revision: "c".repeat(40),
  digest: `sha256:${"a".repeat(64)}`,
};
const destination = "docker.io/enthouan/trello-mcp";
const expression = (value: string) => `$${`{{ ${value} }}`}`;
const workflow = (filename: string) =>
  parse(
    readFileSync(
      new URL(`../.github/workflows/${filename}`, import.meta.url),
      "utf8",
    ),
  );

describe("Docker Hub writer", () => {
  it.each(["success", "login denied", "guard failed", "uncertain write"])(
    "isolates publisher credentials and cleans up after %s",
    async (outcome) => {
      const root = mkdtempSync(join(tmpdir(), "test-regctl-"));
      const token = "test-only-token";
      const env = {
        PATH: "/usr/bin",
        DOCKERHUB_USERNAME: "enthouan",
        DOCKERHUB_TOKEN: token,
        DOCKERHUB_CONFIRMED_REPOSITORY: destination,
        MIRROR_TEMP: root,
        GITHUB_TOKEN: "unrelated",
        DOCKER_CONFIG: "inherited",
      };
      let directory = "";
      const order: string[] = [];
      const run = vi.fn(
        (
          file: string,
          args: string[],
          child: NodeJS.ProcessEnv,
          input?: string | Buffer,
        ) => {
          order.push(args[0] ?? "");
          expect(file).toBe(join(root, "regctl"));
          directory = child.HOME ?? "";
          expect(directory.startsWith(join(root, "auth-"))).toBe(true);
          expect(statSync(directory).mode & 0o777).toBe(0o700);
          expect(child).toEqual({
            HOME: directory,
            PATH: env.PATH,
            DOCKER_CONFIG: directory,
            REGCTL_CONFIG: join(directory, "regctl.json"),
          });
          expect(args.join(" ")).not.toContain(token);
          expect(input).toBe(args[0] === "registry" ? token : undefined);
          if (args[0] === "registry") {
            expect(args).toEqual([
              "registry",
              "login",
              "docker.io",
              "--user",
              "enthouan",
              "--pass-stdin",
            ]);
            return outcome === "login denied" ? null : Buffer.alloc(0);
          }
          if (args[0] === "image") {
            expect(args).toEqual([
              "image",
              "copy",
              "--force-recursive",
              `ghcr.io/enthouan/trello-mcp@${identity.digest}`,
              `${destination}:${identity.version}`,
            ]);
            return outcome === "uncertain write" ? null : Buffer.alloc(0);
          }
          expect(args).toEqual([
            "config",
            "set",
            "--docker-cred=false",
            "--docker-cert=false",
          ]);
          return Buffer.alloc(0);
        },
      );
      try {
        const result = copyImage(
          identity,
          identity.version,
          env,
          async () => {
            order.push("guard");
            if (outcome === "guard failed")
              throw new Error("destination changed");
          },
          run,
        );
        if (outcome === "login denied" || outcome === "guard failed") {
          await expect(result).rejects.toThrow(
            outcome === "login denied"
              ? "Docker Hub login failed"
              : "destination changed",
          );
          expect(order).not.toContain("image");
        } else {
          expect(await result).toBe(outcome === "success");
          expect(order).toEqual(["config", "registry", "guard", "image"]);
        }
        expect(existsSync(directory)).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it.each([
    "success",
    "read failed",
    "digest mismatch",
    "guard failed",
    "uncertain PUT",
  ])(
    "sets latest with just the original Hub index bytes after the ownership guard (%s)",
    async (outcome) => {
      // Keep the final newline and whitespace that reserializing the JSON would lose.
      const index = Buffer.from(
        '{  "schemaVersion": 2, "mediaType": "application/vnd.oci.image.index.v1+json", "manifests": [] }\n',
      );
      const digest = `sha256:${createHash("sha256").update(index).digest("hex")}`;
      const root = mkdtempSync(join(tmpdir(), "test-regctl-latest-"));
      const token = "test-only-token";
      const env = {
        PATH: "/usr/bin",
        MIRROR_TEMP: root,
        DOCKERHUB_USERNAME: "enthouan",
        DOCKERHUB_TOKEN: token,
        DOCKERHUB_CONFIRMED_REPOSITORY: destination,
      };
      const order: string[] = [];
      let directory = "";
      const run = (
        file: string,
        args: string[],
        child: NodeJS.ProcessEnv,
        input?: string | Buffer,
        capture?: boolean,
      ) => {
        const command = args.slice(0, 2).join(" ");
        order.push(command);
        directory = child.HOME ?? "";
        expect(file).toBe(join(root, "regctl"));
        expect(Object.values(child)).not.toContain(token);
        expect(args.join(" ")).not.toContain(token);
        if (command === "manifest get") {
          expect(args).toEqual([
            "manifest",
            "get",
            "--format",
            "raw-body",
            `${destination}@${digest}`,
          ]);
          expect(input).toBeUndefined();
          expect(capture).toBe(true);
          if (outcome === "read failed") return null;
          return outcome === "digest mismatch"
            ? Buffer.from(index.toString().trimEnd())
            : index;
        }
        expect(capture).toBeUndefined();
        if (command === "manifest put") {
          expect(args).toEqual([
            "manifest",
            "put",
            "--content-type",
            "application/vnd.oci.image.index.v1+json",
            `${destination}:latest`,
          ]);
          expect(input).toEqual(index);
          return outcome === "uncertain PUT" ? null : Buffer.alloc(0);
        }
        expect(["config set", "registry login"]).toContain(command);
        expect(input).toBe(command === "registry login" ? token : undefined);
        return Buffer.alloc(0);
      };
      try {
        const result = copyImage(
          { ...identity, digest },
          "latest",
          env,
          async () => {
            order.push("guard");
            if (outcome === "guard failed") throw new Error("newer release");
          },
          run,
        );
        if (outcome === "read failed" || outcome === "digest mismatch") {
          await expect(result).rejects.toThrow(
            outcome === "read failed" ? "Unable to read" : "index bytes differ",
          );
          expect(order).toEqual(["config set", "manifest get"]);
        } else if (outcome === "guard failed") {
          await expect(result).rejects.toThrow("newer release");
          expect(order).toEqual([
            "config set",
            "manifest get",
            "registry login",
            "guard",
          ]);
        } else {
          expect(await result).toBe(outcome === "success");
          expect(order).toEqual([
            "config set",
            "manifest get",
            "registry login",
            "guard",
            "manifest put",
          ]);
        }
        expect(existsSync(directory)).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("requires canonical confirmation, publisher account and an exact or latest tag before login", async () => {
    const run = vi.fn();
    const env = {
      DOCKERHUB_CONFIRMED_REPOSITORY: destination,
      DOCKERHUB_USERNAME: "enthouan",
      DOCKERHUB_TOKEN: "test",
      MIRROR_TEMP: tmpdir(),
    };
    for (const [tag, fields] of [
      ["1.2", {}],
      [identity.version, { DOCKERHUB_USERNAME: "other" }],
      [identity.version, { DOCKERHUB_CONFIRMED_REPOSITORY: "wrong" }],
    ] as const)
      await expect(
        copyImage(identity, tag, { ...env, ...fields }, async () => {}, run),
      ).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });
});

describe("Docker Hub workflow integration", () => {
  const release = workflow("release.yml");
  const mirror = workflow("docker-hub-mirror.yml");
  const { preview, mirror: writer } = mirror.jobs;
  it("passes verified identity to an independent stable-only consumer", () => {
    expect(release.jobs["docker-hub"]).toMatchObject({
      needs: "image",
      permissions: { contents: "read" },
      uses: "./.github/workflows/docker-hub-mirror.yml",
      with: {
        tag: expression("github.ref_name"),
        revision: expression("needs.image.outputs.revision"),
        digest: expression("needs.image.outputs.digest"),
        "tag-object": expression("needs.image.outputs.tag-object"),
      },
    });
    for (const gate of [
      "github.repository == 'enthouan/trello-mcp'",
      "github.event_name == 'push'",
      "needs.image.outputs.stable == 'true'",
    ])
      expect(release.jobs["docker-hub"].if).toContain(gate);
    expect(release.jobs["docker-hub"].secrets).toEqual({
      DOCKERHUB_USERNAME: expression("secrets.DOCKERHUB_USERNAME"),
      DOCKERHUB_TOKEN: expression("secrets.DOCKERHUB_TOKEN"),
    });
    expect(mirror.on.workflow_call.secrets).toEqual({
      DOCKERHUB_USERNAME: { required: true },
      DOCKERHUB_TOKEN: { required: true },
    });
    expect(release.jobs.image.outputs.revision).toBe(
      expression("steps.verify.outputs.revision"),
    );
    expect(release.jobs.image.outputs["tag-object"]).toBe(
      expression("steps.verify.outputs.tag-object"),
    );
    expect(release.jobs.registry.needs).toBe("image");
    expect(release.concurrency).toBeUndefined();
    expect(release.jobs.image.concurrency.group).not.toBe(
      writer.concurrency.group,
    );
  });
  it("keeps preview secret-free and all mirror writers in one queue", () => {
    expect(Object.keys(mirror.on).sort()).toEqual([
      "workflow_call",
      "workflow_dispatch",
    ]);
    expect(mirror.on.workflow_dispatch.inputs.publish).toMatchObject({
      type: "boolean",
      default: false,
    });
    expect(preview.if).toContain(
      "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'",
    );
    expect(preview.environment).toBeUndefined();
    expect(JSON.stringify(preview)).not.toContain("secrets.");
    expect(mirror.permissions).toEqual({ contents: "read" });
    expect(writer.permissions).toBeUndefined();
    expect(writer.environment).toBe("docker-hub-mirror");
    expect(writer.needs).toBe("preview");
    expect(writer.if).toBe("github.event_name == 'push' || inputs.publish");
    expect(writer.concurrency).toEqual({
      group: `docker-hub-stable-mirror-${expression("github.repository")}`,
      queue: "max",
      "cancel-in-progress": false,
    });
    expect(writer.env.EXPECTED_TAG_OBJECT).toBe(
      expression("needs.preview.outputs.tag-object"),
    );
    for (const job of [preview, writer]) {
      expect(job.steps[0].with).toMatchObject({
        ref: expression("github.sha"),
        "fetch-depth": 0,
        "persist-credentials": false,
      });
      expect(
        job.steps.some(
          (s: { run?: string }) => s.run === "pnpm install --frozen-lockfile",
        ),
      ).toBe(true);
    }
  });
  it("isolates exact and latest writes around anonymous discovery, and verifies the pinned copier", () => {
    type Step = {
      env?: Record<string, string>;
      id?: string;
      run?: string;
      if?: string;
    };
    const steps: Step[] = writer.steps;
    const commands = steps.filter((step) =>
      step.run?.includes("scripts/docker-hub-mirror.ts"),
    );
    expect(commands.map((step) => step.run?.split(" ").at(-1))).toEqual([
      "exact",
      "discover",
      "latest",
    ]);
    expect(
      steps.filter((step) =>
        JSON.stringify(step.env ?? {}).includes("secrets."),
      ),
    ).toEqual([commands[0], commands[2]]);
    expect(commands[0]?.env?.DOCKERHUB_TOKEN).toBe(
      expression("secrets.DOCKERHUB_TOKEN"),
    );
    const pin = steps.find((step) => step.id === "regctl");
    expect(pin?.env).toEqual({
      REGCTL_VERSION: "v0.11.7",
      REGCTL_SHA256:
        "3737fbbdd791e04e7a831640b681f3397a376498e80e2ad9b1b2d27296f239bc",
    });
    for (const check of [
      "Linux/x86_64",
      "regctl-linux-amd64",
      "sha256sum --check --strict",
    ])
      expect(pin?.run).toContain(check);
    expect(
      steps.find((step) => step.run?.includes('rm -rf -- "$MIRROR_TEMP"'))?.if,
    ).toContain("always()");
    expect(JSON.stringify(mirror)).not.toContain("continue-on-error");
  });
});
