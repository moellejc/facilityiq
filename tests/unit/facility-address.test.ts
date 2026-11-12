import { describe, expect, it } from "vitest";

import { presentFacilityAddress } from "@/lib/facilities";

const empty = {
  addressStreet: null,
  addressCity: null,
  addressRegion: null,
  addressPostalCode: null,
  addressCountry: null,
};

describe("presentFacilityAddress", () => {
  it("returns null when the facility has no street address", () => {
    expect(presentFacilityAddress(empty)).toBeNull();
  });

  it("returns null when any address column is missing", () => {
    expect(
      presentFacilityAddress({
        ...empty,
        addressStreet: "4800 Harbor Avenue",
        addressCity: "Tacoma",
      }),
    ).toBeNull();
  });

  it("returns the structured address when street, city, region, postal code, and country are set", () => {
    expect(
      presentFacilityAddress({
        addressStreet: "4800 Harbor Avenue",
        addressCity: "Tacoma",
        addressRegion: "WA",
        addressPostalCode: "98421",
        addressCountry: "United States",
      }),
    ).toEqual({
      street: "4800 Harbor Avenue",
      city: "Tacoma",
      region: "WA",
      postalCode: "98421",
      country: "United States",
    });
  });
});
