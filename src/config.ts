import { z } from "zod";

const LogLevelSchema = z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]);

const ConfigSchema = z.object({
  TRELLO_API_KEY: z.string().min(1, "TRELLO_API_KEY is required"),
  TRELLO_TOKEN: z.string().min(1, "TRELLO_TOKEN is required"),
  TRELLO_OAUTH_TOKEN: z.string().min(1).optional(),
  TRANSPORT: z.enum(["http", "stdio"]).default("http"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  LOG_LEVEL: LogLevelSchema.default("info")
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse(env);
}
