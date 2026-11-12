import { describe, expect, it } from "vitest";

import {
  addressCreatePatch,
  addressFieldErrors,
  addressUpdateBody,
} from "@/lib/facility-address-form";
import { facilityUpdateSchema } from "@/lib/validation";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("facility address form mapping", () => {
  it("omits address when every street-address field is blank", () => {
    expect(
      addressCreatePatch(
        form({
          addressStreet: "  ",
          addressCity: "",
          addressRegion: "",
          addressPostalCode: "",
          addressCountry: "",
        }),
      ),
    ).toEqual({});
  });

  it("sends an address when only the street is filled", () => {
    expect(addressCreatePatch(form({ addressStreet: " 4800 Harbor Avenue " }))).toEqual({
      address: {
        street: "4800 Harbor Avenue",
        city: "",
        region: "",
        postalCode: "",
        country: "",
      },
    });
  });

  it("sends null when clearAddress is true", () => {
    expect(
      addressUpdateBody(form({ clearAddress: "true", addressStreet: "4800 Harbor Avenue" })),
    ).toEqual({ address: null });
  });

  it("sends the trimmed lines when the edit form does not clear the address", () => {
    expect(
      addressUpdateBody(
        form({
          addressStreet: " 4800 Harbor Avenue ",
          addressCity: " Tacoma ",
          addressRegion: " WA ",
          addressPostalCode: " 98421 ",
          addressCountry: " United States ",
        }),
      ),
    ).toEqual({
      address: {
        street: "4800 Harbor Avenue",
        city: "Tacoma",
        region: "WA",
        postalCode: "98421",
        country: "United States",
      },
    });
  });

  it("sends the trimmed lines when clearAddress is not the string true", () => {
    expect(
      addressUpdateBody(
        form({
          clearAddress: "false",
          addressStreet: " 1 Main Street ",
          addressCity: "Tacoma",
          addressRegion: "WA",
          addressPostalCode: "98421",
          addressCountry: "United States",
        }),
      ),
    ).toEqual({
      address: {
        street: "1 Main Street",
        city: "Tacoma",
        region: "WA",
        postalCode: "98421",
        country: "United States",
      },
    });
  });

  it("maps a blank street to fieldErrors.addressStreet", () => {
    const parsed = facilityUpdateSchema.safeParse({
      address: {
        street: " ",
        city: "Tacoma",
        region: "WA",
        postalCode: "98421",
        country: "United States",
      },
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(addressFieldErrors(parsed.error)).toEqual({
        error: "Street is required.",
        fieldErrors: { addressStreet: "Street is required." },
      });
    }
  });

  it("returns null when the error is not a validation error", () => {
    expect(addressFieldErrors(new Error("nope"))).toBeNull();
  });
});
