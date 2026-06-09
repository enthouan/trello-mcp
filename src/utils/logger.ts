import pino from "pino";
import type { Config } from "../config.js";

export type Logger = pino.Logger;

type LoggerConfig = Pick<Config, "LOG_LEVEL"> &
  Partial<Pick<Config, "TRANSPORT">>;

export const LOGGER_REDACTION_PATHS = [
  "TRELLO_API_KEY",
  "TRELLO_TOKEN",
  "MCP_AUTH_TOKEN",
  "*.MCP_AUTH_TOKEN",
  "*.key",
  "*.token",
  "authorization",
  "Authorization",
  "*.authorization",
  "*.Authorization",
  "headers.authorization",
  "headers.Authorization",
  "*.headers.authorization",
  "*.headers.Authorization",
];

export function createLogger(
  config: LoggerConfig,
  destinationStream?: pino.DestinationStream,
): Logger {
  const destinationFd =
    config.TRANSPORT === "stdio" || process.env.TRANSPORT === "stdio" ? 2 : 1;

  return pino(
    {
      level: config.LOG_LEVEL,
      redact: {
        paths: [...LOGGER_REDACTION_PATHS],
        remove: true,
      },
    },
    destinationStream ?? pino.destination(destinationFd),
  );
}

export function childLogger(
  logger: Logger,
  bindings: Record<string, string>,
): Logger {
  return logger.child(bindings);
}
