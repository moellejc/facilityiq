"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  INTEGRATION_PROVIDER_LABELS,
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUS_LABELS,
  INTEGRATION_STATUSES,
  type IntegrationProvider,
  type IntegrationStatus,
} from "@/lib/integrations";
import {
  createIntegrationAction,
  removeIntegrationAction,
  updateIntegrationAction,
} from "@/server/actions/admin";

type FormState = { error?: string; ok?: string };

const controlClass = "h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm";

export type AdminIntegration = {
  id: string;
  name: string;
  provider: string;
  status: string;
  externalReference: string | null;
};

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="text-sm text-rose-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-emerald-700">{state.ok}</p>;
  return null;
}

function providerValue(value: string): IntegrationProvider {
  return INTEGRATION_PROVIDERS.find((provider) => provider === value) ?? "custom";
}

function statusValue(value: string): IntegrationStatus {
  return INTEGRATION_STATUSES.find((status) => status === value) ?? "active";
}

function IntegrationFields({
  integration,
  idPrefix,
}: {
  integration?: AdminIntegration;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          defaultValue={integration?.name ?? ""}
          required
          minLength={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-provider`}>Provider</Label>
        <select
          id={`${idPrefix}-provider`}
          name="provider"
          defaultValue={integration ? providerValue(integration.provider) : "custom"}
          className={controlClass}
        >
          {INTEGRATION_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {INTEGRATION_PROVIDER_LABELS[provider]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-status`}>Status</Label>
        <select
          id={`${idPrefix}-status`}
          name="status"
          defaultValue={integration ? statusValue(integration.status) : "active"}
          className={controlClass}
        >
          {INTEGRATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {INTEGRATION_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-reference`}>External reference</Label>
        <Input
          id={`${idPrefix}-reference`}
          name="externalReference"
          defaultValue={integration?.externalReference ?? ""}
          autoComplete="off"
        />
      </div>
    </div>
  );
}

function CreateIntegrationForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createIntegrationAction, {});
  return (
    <form action={action} className="space-y-3">
      <IntegrationFields idPrefix="new-integration" />
      <p className="text-sm text-slate-600">
        Optional reference only. Do not enter passwords or API keys. This panel does not store
        credentials or run a synchronization.
      </p>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add integration"}
      </Button>
    </form>
  );
}

function UpdateIntegrationForm({ integration }: { integration: AdminIntegration }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateIntegrationAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="integrationId" value={integration.id} />
      <IntegrationFields integration={integration} idPrefix={`integration-${integration.id}`} />
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save integration"}
      </Button>
    </form>
  );
}

function RemoveIntegrationForm({ integration }: { integration: AdminIntegration }) {
  const [state, action, pending] = useActionState<FormState, FormData>(removeIntegrationAction, {});
  return (
    <form action={action} className="space-y-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="integrationId" value={integration.id} />
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" name="confirm" required className="mt-1" />
        <span>Remove {integration.name}.</span>
      </label>
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Removing…" : "Remove integration"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function IntegrationsPanel({
  integrations,
  total,
}: {
  integrations: AdminIntegration[];
  total: number;
}) {
  return (
    <div className="space-y-6">
      <CreateIntegrationForm />
      {integrations.length === 0 ? (
        <p className="text-sm text-slate-600">
          No integrations are recorded for this organization.
        </p>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div key={integration.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
              <UpdateIntegrationForm integration={integration} />
              <RemoveIntegrationForm integration={integration} />
            </div>
          ))}
          {total > integrations.length ? (
            <p className="text-sm text-slate-600">
              Showing {integrations.length} of {total} integrations.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
