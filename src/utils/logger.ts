import pino from "pino";
import type { Config } from "../config.js";

export type Logger = pino.Logger;

export function createLogger(config: Pick<Config, "LOG_LEVEL">): Logger {
  return pino({
    level: config.LOG_LEVEL,
    redact: {
      paths: ["TRELLO_API_KEY", "TRELLO_TOKEN", "*.key", "*.token"],
      remove: true,
    },
  });
}

export function childLogger(
  logger: Logger,
  bindings: Record<string, string>,
): Logger {
  return logger.child(bindings);
}
