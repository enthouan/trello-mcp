import { ValidationError } from "../utils/errors.js";

const TRELLO_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isTrelloWebHostname(hostname: string): boolean {
  return hostname === "trello.com" || hostname === "www.trello.com";
}

export function trelloIdentifierFromUrl(
  value: string,
  acceptedPathPrefixes: readonly string[],
): string | undefined {
  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/");
    const identifier = pathParts[2];
    const suffixSegments = pathParts.slice(3);
    const hasEmptySuffixSegment = suffixSegments.some(
      (segment, index) => !segment && index < suffixSegments.length - 1,
    );
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      isTrelloWebHostname(url.hostname) &&
      pathParts[0] === "" &&
      acceptedPathPrefixes.includes(pathParts[1] ?? "") &&
      identifier &&
      TRELLO_IDENTIFIER_PATTERN.test(identifier) &&
      !hasEmptySuffixSegment
    ) {
      return identifier;
    }
  } catch {
    // Non-URL values are handled by the caller.
  }
  return undefined;
}

export function normalizeTrelloCardIdentifier(cardId: string): string {
  const value = cardId.trim();
  if (TRELLO_IDENTIFIER_PATTERN.test(value)) {
    return value;
  }

  const identifier = trelloIdentifierFromUrl(value, ["c"]);
  if (!identifier) {
    throw new ValidationError(
      "cardId must be a Trello card id, short link, or HTTPS card URL on trello.com.",
    );
  }
  return identifier;
}
