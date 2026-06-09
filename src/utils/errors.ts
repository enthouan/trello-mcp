import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";

export type ErrorDetails = Record<
  string,
  string | number | boolean | undefined
>;

export class AppError extends Error {
  public readonly details: ErrorDetails | undefined;

  public constructor(message: string, details?: ErrorDetails) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class ConfigError extends AppError {}
export class ValidationError extends AppError {}
export class AuthError extends AppError {}
export class PermissionError extends AppError {}
export class NotFoundError extends AppError {}
export class RateLimitError extends AppError {}

export class TrelloApiError extends AppError {
  public readonly status: number;

  public constructor(status: number, message: string, details?: ErrorDetails) {
    super(message, details);
    this.status = status;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof ZodError) {
    return new ValidationError("Input or response validation failed.", {
      issues: error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    });
  }
  if (error instanceof Error) {
    return new AppError(error.message);
  }
  return new AppError("An unknown error occurred.");
}

export function toMcpError(error: unknown): McpError {
  const appError = toAppError(error);
  if (appError instanceof ValidationError) {
    return new McpError(
      ErrorCode.InvalidParams,
      appError.message,
      appError.details,
    );
  }
  if (appError instanceof AuthError) {
    return new McpError(
      ErrorCode.InvalidRequest,
      appError.message,
      appError.details,
    );
  }
  if (appError instanceof PermissionError) {
    return new McpError(
      ErrorCode.InvalidRequest,
      appError.message,
      appError.details,
    );
  }
  if (appError instanceof NotFoundError) {
    return new McpError(
      ErrorCode.InvalidRequest,
      appError.message,
      appError.details,
    );
  }
  if (appError instanceof RateLimitError) {
    return new McpError(
      ErrorCode.InternalError,
      appError.message,
      appError.details,
    );
  }
  if (appError instanceof TrelloApiError) {
    return new McpError(
      ErrorCode.InternalError,
      appError.message,
      appError.details,
    );
  }
  return new McpError(
    ErrorCode.InternalError,
    appError.message,
    appError.details,
  );
}
