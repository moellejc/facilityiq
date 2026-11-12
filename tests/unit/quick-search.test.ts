import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { parseQuickSearchQuery } from "@/lib/quick-search";

const organizationId = "e96b9b4b-9e1f-5160-af43-d090000e6b64";

function rejectedQuery(input: { q: string; organizationId: string }) {
  try {
    parseQuickSearchQuery(input);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("parseQuickSearchQuery", () => {
  it("returns the trimmed query and organization id", () => {
    expect(parseQuickSearchQuery({ q: "  West ", organizationId: ` ${organizationId} ` })).toEqual({
      q: "West",
      organizationId,
    });
  });

  it("rejects a query shorter than 2 characters", () => {
    expect(rejectedQuery({ q: "a", organizationId })).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "q must be between 2 and 40 characters",
      status: 400,
    });
    expect(rejectedQuery({ q: "a", organizationId })).toBeInstanceOf(AppError);
  });

  it("rejects a query that contains punctuation", () => {
    expect(rejectedQuery({ q: "west!", organizationId })).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "q may only contain letters, numbers, and spaces",
    });
  });

  it("rejects an organization id that is not a uuid", () => {
    expect(rejectedQuery({ q: "West", organizationId: "acme" })).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "organizationId must be a uuid query parameter",
    });
  });
});
