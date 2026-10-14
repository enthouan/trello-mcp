import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  imageName,
  imageVerificationInput,
  verifyImageEvidence,
} from "./lib/mcp-registry.js";

const usage =
  "Usage: corepack pnpm image:verify --version X.Y.Z --revision <40 lowercase hex> --digest sha256:<64 lowercase hex>";

// This entrypoint has no release-event, local-manifest, Docker, or Trello setup.
export async function verifyImageCommand(
  args: string[],
  fetcher: typeof fetch = fetch,
): Promise<string> {
  let input: ReturnType<typeof imageVerificationInput.parse>;
  try {
    const { values, tokens } = parseArgs({
      args,
      options: {
        version: { type: "string" },
        revision: { type: "string" },
        digest: { type: "string" },
      },
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const names = tokens
      .filter((token) => token.kind === "option")
      .map((token) => token.name);
    if (new Set(names).size !== names.length)
      throw new Error("Duplicate option");
    input = imageVerificationInput.parse(values);
  } catch {
    throw new Error(usage);
  }
  const evidence = await verifyImageEvidence(
    { version: input.version },
    input.revision,
    input.digest,
    fetcher,
  );
  if (!evidence)
    throw new Error("The exact versioned image is not publicly available.");
  return JSON.stringify(
    {
      image: `${imageName}@${evidence.digest}`,
      version: input.version,
      revision: input.revision,
      ...evidence,
      scope:
        "Anonymous metadata integrity and release-label consistency; platform/config/attestation SHA-256 chains, subject binding, populated SPDX SBOMs, maximum BuildKit provenance.",
      publisherAuthentication:
        "Not verified. Trust the expected digest through a separately reviewed source; registry metadata is not a publisher signature.",
      limitations:
        "No filesystem layer download, container execution, vulnerability scan, SBOM completeness check, or independent authentication of source/build claims.",
    },
    null,
    2,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    console.log(await verifyImageCommand(process.argv.slice(2)));
  } catch {
    // Do not echo arbitrary registry bodies, request details, or raw errors.
    console.error(
      `Image verification failed: invalid inputs or unavailable, mismatched, or incomplete evidence.\n${usage}`,
    );
    process.exitCode = 1;
  }
}
