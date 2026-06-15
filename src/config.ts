import { isAbsolute } from "node:path";
import { z } from "zod";

const LogLevelSchema = z.enum([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
]);

const positiveIntegerEnv = (defaultValue: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.coerce.number().int().positive().default(defaultValue),
  );

const ConfigSchema = z.object({
  TRELLO_API_KEY: z.string().min(1, "TRELLO_API_KEY is required"),
  TRELLO_TOKEN: z.string().min(1, "TRELLO_TOKEN is required"),
  MCP_AUTH_TOKEN: z
    .preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().trim().min(1).optional(),
    )
    .describe("Optional bearer token required for HTTP MCP endpoint requests."),
  TRELLO_ATTACHMENT_UPLOAD_ROOT: z
    .preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z
        .string()
        .trim()
        .min(1)
        .refine(isAbsolute, {
          message: "TRELLO_ATTACHMENT_UPLOAD_ROOT must be an absolute path.",
        })
        .optional(),
    )
    .describe(
      "Optional server-side directory that enables local file attachment uploads.",
    ),
  TRANSPORT: z.enum(["http", "stdio"]).default("http"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  LOG_LEVEL: LogLevelSchema.default("info"),
  TRELLO_RATE_LIMIT_CAPACITY: positiveIntegerEnv(100),
  TRELLO_RATE_LIMIT_REFILL_INTERVAL_MS: positiveIntegerEnv(10_000),
  TRELLO_RETRY_MAX_ATTEMPTS: positiveIntegerEnv(3),
  TRELLO_RETRY_BASE_DELAY_MS: positiveIntegerEnv(100),
  TRELLO_RETRY_MAX_DELAY_MS: positiveIntegerEnv(2_000),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse(env);
}
