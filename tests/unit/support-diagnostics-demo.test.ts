import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/support/diagnostics/route";
import {
  DEMO_API_TOKEN,
  DEMO_AWS_ACCESS_KEY_ID,
  DEMO_AWS_SECRET_ACCESS_KEY,
} from "@/lib/support/demo-credentials";

const organizationId = "00000000-0000-4000-8000-000000000099";

describe("support diagnostics demo", () => {
  it("keeps the planted credentials on the documented fake examples", () => {
    expect(DEMO_AWS_ACCESS_KEY_ID).toBe("AKIAIOSFODNN7EXAMPLE");
    expect(DEMO_AWS_SECRET_ACCESS_KEY).toBe("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    expect(DEMO_API_TOKEN).toBe("sk_test_facilityiq_demo_not_a_real_key");
  });

  it("rejects a diagnostics request that omits organizationId", async () => {
    const response = await GET(new NextRequest("http://localhost/api/support/diagnostics"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message: "organizationId is required." },
    });
  });

  it("returns the client organization id inside the concatenated lookup", async () => {
    const response = await GET(
      new NextRequest(
        `http://localhost/api/support/diagnostics?organizationId=${organizationId}&label=demo`,
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKeyLoaded: true,
        demoTokenLoaded: true,
        organizationId,
        label: "demo",
        lookupSql:
          "SELECT id, name FROM organizations WHERE id = '" +
          organizationId +
          "' AND name ILIKE '%demo%'",
        sqlFragmentChunks: 1,
      },
    });
  });
});
