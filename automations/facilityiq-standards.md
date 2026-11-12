# FacilityIQ Standards automations (split)

**Not live until Joe creates each automation in the Cursor UI** ([cursor.com/automations](https://cursor.com/automations), Agents Window, or `/automate`). Committing these files does not create, enable, rename, or disable anything in Cursor. A JSON import format was not verified.

## What this replaces

The monolithic Cursor Automation **[FacilityIQ Standards](https://cursor.com/automations/1ed21257-dbe4-11f1-8120-06b44be262b7)** (`1ed21257-dbe4-11f1-8120-06b44be262b7`) audited every PR against all five Notion standards pages in one prompt and posted one combined review.

That checklist is now **five focused automations**, one per standards page. Create the five below, then **disable** (or archive) the monolithic automation so PRs are not double-reviewed.

| Automation name (exact)                           | Spec                                                                                         | Notion page                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `FacilityIQ Standards: Engineering Standards hub` | [`facilityiq-standards-hub.md`](./facilityiq-standards-hub.md)                               | [Engineering Standards hub](https://app.notion.com/p/412dfbf62ea381a7a59ef93663d04096)        |
| `FacilityIQ Standards: Coding Conventions`        | [`facilityiq-standards-coding-conventions.md`](./facilityiq-standards-coding-conventions.md) | [Coding Conventions](https://app.notion.com/p/412dfbf62ea38190b53fe01218cf169b) (esp. §§3–17) |
| `FacilityIQ Standards: Unit Test Standards`       | [`facilityiq-standards-unit-tests.md`](./facilityiq-standards-unit-tests.md)                 | [Unit Test Standards](https://app.notion.com/p/412dfbf62ea381cbbfeefcd14c587f19)              |
| `FacilityIQ Standards: CI Process`                | [`facilityiq-standards-ci-process.md`](./facilityiq-standards-ci-process.md)                 | [CI Process](https://app.notion.com/p/412dfbf62ea381bcae7fc83c967ba35d)                       |
| `FacilityIQ Standards: SDLC Best Practices`       | [`facilityiq-standards-sdlc.md`](./facilityiq-standards-sdlc.md)                             | [SDLC Best Practices](https://app.notion.com/p/412dfbf62ea3813485bcc70c17a74feb)              |

Related but separate (other PRs / already on `main`): mechanical pre-PR guardrail review and Next.js drift watcher specs when those land; [`slack-linear-agent-pr.md`](./slack-linear-agent-pr.md) is already in-tree.

## Shared settings (every Standards automation)

Copy these into each UI create unless a per-spec file overrides them.

| Setting                    | Value                                                                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository                 | `moellejc/facilityiq` (single repository; inferred from the PR for source-control triggers)                                                                                                                                                            |
| Triggers                   | GitHub → **Pull request opened** and **Pull request pushed**. Do **not** add Draft opened. Fork PRs are unsupported. On each push, post (or update) a review of the **current** range; never stay silent because an older comment could not be edited. |
| Comment on pull request    | **On**. Approvals **Off** (comment only; never approve, request changes, or dismiss).                                                                                                                                                                  |
| Request reviewers          | Off                                                                                                                                                                                                                                                    |
| Pull request creation      | Off if the UI allows; the prompt forbids opening PRs either way                                                                                                                                                                                        |
| Send to Slack / Read Slack | Off                                                                                                                                                                                                                                                    |
| Memories                   | **Off** (PR text is untrusted)                                                                                                                                                                                                                         |
| MCP                        | **Notion** (required for live page cites). If Notion MCP auth fails, fall back per prompt and say so.                                                                                                                                                  |
| Computer use               | Left at product default; prompt forbids browsing to mutate GitHub settings                                                                                                                                                                             |

Source for trigger/tool names: [Cursor Automations](https://cursor.com/docs/cloud-agent/automations).

## Joe create checklist

1. Open [cursor.com/automations/new](https://cursor.com/automations/new) (or `/automate`).
2. For each row in the table above: set the **exact** name, triggers, tools, Notion MCP, paste that file’s **Prompt** block, save, enable.
3. Disable the old **FacilityIQ Standards** automation (`1ed21257-dbe4-11f1-8120-06b44be262b7`).
4. Open a small non-draft PR (or mark a draft ready) and confirm five separate comments, each with its own `<!-- facilityiq-standards:… -->` marker.

Creating via Terraform / API is out of scope for this change.
