export type InstallMethodKey = "docker" | "http" | "stdio";

export interface InstallMethod {
  key: InstallMethodKey;
  label: string;
  title: string;
  language: string;
  code: string;
  href: string;
}

export const INSTALL_METHODS = [
  {
    key: "docker",
    label: "Docker",
    title: "Published image with Docker Compose",
    language: "shell",
    href: "get-started/docker/",
    code: `git clone https://github.com/enthouan/trello-mcp.git
cd trello-mcp
cp .env.example .env
# Set TRELLO_API_KEY and TRELLO_TOKEN in .env
\${EDITOR:-vi} .env
grep -Eq '^TRELLO_API_KEY=.+$' .env || { echo 'Set TRELLO_API_KEY in .env before starting.' >&2; exit 1; }
grep -Eq '^TRELLO_TOKEN=.+$' .env || { echo 'Set TRELLO_TOKEN in .env before starting.' >&2; exit 1; }
docker compose up -d
docker compose ps
curl http://127.0.0.1:3000/healthz
curl http://127.0.0.1:3000/readyz`,
  },
  {
    key: "http",
    label: "HTTP",
    title: "Source-built HTTP on Docker loopback",
    language: "shell",
    href: "get-started/http/",
    code: `git clone https://github.com/enthouan/trello-mcp.git
cd trello-mcp
cp .env.example .env
# Set TRELLO_API_KEY and TRELLO_TOKEN in .env
\${EDITOR:-vi} .env
docker compose -f docker-compose.local.yml up --build
curl http://127.0.0.1:3000/healthz
curl http://127.0.0.1:3000/readyz`,
  },
  {
    key: "stdio",
    label: "stdio",
    title: "Desktop client process configuration",
    language: "json",
    href: "get-started/stdio/",
    code: `{
  "mcpServers": {
    "trello": {
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "TRELLO_API_KEY": "replace-with-your-api-key",
        "TRELLO_TOKEN": "replace-with-your-token"
      }
    }
  }
}`,
  },
] as const satisfies readonly InstallMethod[];

export function getInstallMethod(
  key: InstallMethodKey,
): (typeof INSTALL_METHODS)[number] {
  const method = INSTALL_METHODS.find((candidate) => candidate.key === key);
  if (!method) throw new Error(`Unknown install method: ${key}`);
  return method;
}
