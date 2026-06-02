import pino from "pino";
import type { Config } from "../config.js";

export type Logger = pino.Logger;

type LoggerConfig = Pick<Config, "LOG_LEVEL"> &
  Partial<Pick<Config, "TRANSPORT">>;

export function createLogger(config: LoggerConfig): Logger {
  const destination =
    config.TRANSPORT === "stdio" || process.env.TRANSPORT === "stdio" ? 2 : 1;

  return pino(
    {
      level: config.LOG_LEVEL,
      redact: {
        paths: ["TRELLO_API_KEY", "TRELLO_TOKEN", "*.key", "*.token"],
        remove: true,
      },
    },
    pino.destination(destination),
  );
}

export function childLogger(
  logger: Logger,
  bindings: Record<string, string>,
): Logger {
  return logger.child(bindings);
}
