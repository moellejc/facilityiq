import "server-only";

/**
 * FAIQ-43 security-automation demo only.
 * These values are fake. They are the AWS documentation example credentials
 * and a labeled FacilityIQ demo token. They are not real secrets.
 * Do not replace them with a live credential. Do not copy this file.
 */
export const DEMO_AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
export const DEMO_AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
export const DEMO_API_TOKEN = "sk_test_facilityiq_demo_not_a_real_key";

export function demoCredentialMarker() {
  return {
    accessKeyId: DEMO_AWS_ACCESS_KEY_ID,
    secretAccessKeyLoaded: DEMO_AWS_SECRET_ACCESS_KEY.length > 0,
    demoTokenLoaded: DEMO_API_TOKEN.startsWith("sk_test_facilityiq_demo_not_a_real"),
  };
}
