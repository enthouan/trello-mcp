import { describe, expect, it } from "vitest";
import { includeRequiredFields } from "../src/trello/fields.js";

describe("includeRequiredFields", () => {
  it("adds required fields that were omitted from a projection", () => {
    expect(includeRequiredFields("labels,idLabels", ["name"])).toBe(
      "labels,idLabels,name",
    );
  });

  it("preserves all projections", () => {
    expect(includeRequiredFields("all", ["name"])).toBe("all");
  });

  it("does not duplicate required fields already requested", () => {
    expect(includeRequiredFields("name,idLabels,labels", ["name"])).toBe(
      "name,idLabels,labels",
    );
  });

  it("normalizes none or empty projections to the required fields", () => {
    expect(includeRequiredFields("none", ["name"])).toBe("name");
    expect(includeRequiredFields("", ["name"])).toBe("name");
  });
});
