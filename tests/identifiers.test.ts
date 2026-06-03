import { describe, expect, it } from "vitest";
import { cardIdentifier, cardPath } from "../src/trello/identifiers.js";

describe("Trello identifiers", () => {
  it("uses card ids and short links directly", () => {
    expect(cardIdentifier("card1")).toBe("card1");
    expect(cardPath("AbCd1234")).toBe("/cards/AbCd1234");
  });

  it("extracts short links from Trello card URLs", () => {
    expect(cardIdentifier("https://trello.com/c/AbCd1234/example-card")).toBe(
      "AbCd1234",
    );
    expect(cardPath("https://trello.com/c/AbCd1234/example-card")).toBe(
      "/cards/AbCd1234",
    );
  });
});
