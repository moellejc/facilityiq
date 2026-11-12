export const INTEGRATION_PROVIDERS = ["sap", "custom"] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  sap: "SAP",
  custom: "Custom",
};

export const INTEGRATION_STATUSES = ["active", "disabled"] as const;

export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  active: "Active",
  disabled: "Disabled",
};
