import { describe, expect, it } from "vitest";
import {
  normalizeTrelloCardIdentifier,
  trelloIdentifierFromUrl,
} from "../src/trello/identifiers.js";

describe("Trello identifier normalization", () => {
  it.each([
    "https://trello.com/c/AbCd1234/example-card",
    "https://www.trello.com/c/AbCd1234",
    "https://TRELLO.COM:443/c/AbCd1234/",
  ])("extracts an identifier from a canonical Trello URL: %s", (value) => {
    expect(trelloIdentifierFromUrl(value, ["c"])).toBe("AbCd1234");
  });

  it.each([
    "http://trello.com/c/AbCd1234/example-card",
    "https://trello.com:8443/c/AbCd1234/example-card",
    "https://evil.example@trello.com/c/AbCd1234/example-card",
    "https://trello.com@evil.example/c/AbCd1234/example-card",
    "https://trello.com/b/AbCd1234/example-board",
    "https://trello.com/example/c/AbCd1234/example-card",
    "https://trello.com/c/",
    "https://trello.com//c/AbCd1234/example-card",
    "https://trello.com/c//example-card",
    "https://trello.com/c/AbCd1234//example-card",
    "https://trello.com/c/token%3Dleaky-token/example-card",
  ])("rejects a noncanonical Trello URL: %s", (value) => {
    expect(trelloIdentifierFromUrl(value, ["c"])).toBeUndefined();
  });

  it.each([
    [" AbCd1234 ", "AbCd1234"],
    [" 123 ", "123"],
    ["https://trello.com/c/AbCd1234/example-card", "AbCd1234"],
  ])("normalizes supported card references", (value, expected) => {
    expect(normalizeTrelloCardIdentifier(value)).toBe(expected);
  });

  it.each([
    "   ",
    "//eviltrello.com/c/AbCd1234",
    "trello.com/c/AbCd1234",
    "https://eviltrello.com/c/AbCd1234/example-card",
    "https://trello.com/b/AbCd1234/example-board",
    "https://trello.com/c/token%3Dleaky-token/example-card",
  ])("rejects unsupported card references: %s", (value) => {
    expect(() => normalizeTrelloCardIdentifier(value)).toThrow(
      "HTTPS card URL on trello.com",
    );
  });
});
