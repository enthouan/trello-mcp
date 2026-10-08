import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");
const dockerfile = await read("Dockerfile");
const line = dockerfile
  .split("\n")
  .find((value) => value.startsWith("HEALTHCHECK "));
if (!line) throw new Error("Missing image health check");
const command: string[] = JSON.parse(line.split(" CMD ")[1] ?? "null");
const code = command[2];
if (!code || command[0] !== "node" || command[1] !== "-e")
  throw new Error("Unexpected health command");

describe("image-defined container health", () => {
  it("uses process liveness for stdio without attempting HTTP", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const exit = vi.fn();
    await runInNewContext(code, {
      process: { env: { TRANSPORT: "stdio" }, exit },
      fetch: fetcher,
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it.each([{}, { TRANSPORT: "http", PORT: "4321" }])(
    "probes the configured HTTP port for %j",
    async (env) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 200 }));
      const exit = vi.fn();
      await runInNewContext(code, { process: { env, exit }, fetch: fetcher });
      expect(fetcher).toHaveBeenCalledExactlyOnceWith(
        `http://127.0.0.1:${"PORT" in env ? env.PORT : "3000"}/healthz`,
      );
      expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    },
  );

  it.each(["unavailable", "unhealthy"])(
    "fails HTTP health when %s",
    async (failure) => {
      const fetcher = vi.fn<typeof fetch>();
      if (failure === "unavailable")
        fetcher.mockRejectedValue(new Error("connection refused"));
      else fetcher.mockResolvedValue(new Response(null, { status: 503 }));
      const exit = vi.fn();
      await runInNewContext(code, {
        process: { env: {}, exit },
        fetch: fetcher,
      });
      expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    },
  );

  it("keeps the image health behavior in both Compose deployments and the stdio smoke", async () => {
    for (const path of ["docker-compose.yml", "docker-compose.local.yml"]) {
      const compose = parse(await read(path));
      for (const service of Object.values(compose.services) as Record<
        string,
        unknown
      >[])
        expect(service.healthcheck).toBeUndefined();
    }
    expect(await read("scripts/mcp-registry.ts")).not.toContain(
      "--no-healthcheck",
    );
  });
});
