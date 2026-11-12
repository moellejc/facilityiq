import { relations } from "drizzle-orm";

import {
  accounts,
  assetEvents,
  assets,
  auditLogs,
  backgroundJobs,
  facilities,
  facilityAreas,
  facilityLayouts,
  financialMetrics,
  importJobs,
  insights,
  integrations,
  operationalMetrics,
  organizationMembers,
  organizations,
  scenarioResults,
  scenarios,
  sessions,
  uploadedFiles,
  users,
} from "./tables";

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  memberships: many(organizationMembers),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  facilities: many(facilities),
  metrics: many(operationalMetrics),
  financials: many(financialMetrics),
  scenarios: many(scenarios),
  insights: many(insights),
  files: many(uploadedFiles),
  integrations: many(integrations),
  auditLogs: many(auditLogs),
  jobs: many(backgroundJobs),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
}));

export const facilitiesRelations = relations(facilities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [facilities.organizationId],
    references: [organizations.id],
  }),
  areas: many(facilityAreas),
  assets: many(assets),
  layouts: many(facilityLayouts),
  metrics: many(operationalMetrics),
  financials: many(financialMetrics),
  scenarios: many(scenarios),
  insights: many(insights),
}));

export const facilityAreasRelations = relations(facilityAreas, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [facilityAreas.organizationId],
    references: [organizations.id],
  }),
  facility: one(facilities, {
    fields: [facilityAreas.facilityId],
    references: [facilities.id],
  }),
  assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [assets.organizationId],
    references: [organizations.id],
  }),
  facility: one(facilities, { fields: [assets.facilityId], references: [facilities.id] }),
  area: one(facilityAreas, { fields: [assets.areaId], references: [facilityAreas.id] }),
  events: many(assetEvents),
  metrics: many(operationalMetrics),
}));

export const facilityLayoutsRelations = relations(facilityLayouts, ({ one }) => ({
  facility: one(facilities, {
    fields: [facilityLayouts.facilityId],
    references: [facilities.id],
  }),
  organization: one(organizations, {
    fields: [facilityLayouts.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [facilityLayouts.createdBy],
    references: [users.id],
  }),
}));

export const operationalMetricsRelations = relations(operationalMetrics, ({ one }) => ({
  organization: one(organizations, {
    fields: [operationalMetrics.organizationId],
    references: [organizations.id],
  }),
  facility: one(facilities, {
    fields: [operationalMetrics.facilityId],
    references: [facilities.id],
  }),
  area: one(facilityAreas, {
    fields: [operationalMetrics.areaId],
    references: [facilityAreas.id],
  }),
  asset: one(assets, { fields: [operationalMetrics.assetId], references: [assets.id] }),
}));

export const assetEventsRelations = relations(assetEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [assetEvents.organizationId],
    references: [organizations.id],
  }),
  facility: one(facilities, { fields: [assetEvents.facilityId], references: [facilities.id] }),
  area: one(facilityAreas, { fields: [assetEvents.areaId], references: [facilityAreas.id] }),
  asset: one(assets, { fields: [assetEvents.assetId], references: [assets.id] }),
}));

export const financialMetricsRelations = relations(financialMetrics, ({ one }) => ({
  organization: one(organizations, {
    fields: [financialMetrics.organizationId],
    references: [organizations.id],
  }),
  facility: one(facilities, {
    fields: [financialMetrics.facilityId],
    references: [facilities.id],
  }),
  area: one(facilityAreas, {
    fields: [financialMetrics.areaId],
    references: [facilityAreas.id],
  }),
  asset: one(assets, { fields: [financialMetrics.assetId], references: [assets.id] }),
}));

export const scenariosRelations = relations(scenarios, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [scenarios.organizationId],
    references: [organizations.id],
  }),
  facility: one(facilities, { fields: [scenarios.facilityId], references: [facilities.id] }),
  createdByUser: one(users, { fields: [scenarios.createdBy], references: [users.id] }),
  results: many(scenarioResults),
}));

export const scenarioResultsRelations = relations(scenarioResults, ({ one }) => ({
  organization: one(organizations, {
    fields: [scenarioResults.organizationId],
    references: [organizations.id],
  }),
  scenario: one(scenarios, {
    fields: [scenarioResults.scenarioId],
    references: [scenarios.id],
  }),
}));

export const insightsRelations = relations(insights, ({ one }) => ({
  organization: one(organizations, {
    fields: [insights.organizationId],
    references: [organizations.id],
  }),
  facility: one(facilities, { fields: [insights.facilityId], references: [facilities.id] }),
  area: one(facilityAreas, { fields: [insights.areaId], references: [facilityAreas.id] }),
  asset: one(assets, { fields: [insights.assetId], references: [assets.id] }),
}));

export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  organization: one(organizations, {
    fields: [uploadedFiles.organizationId],
    references: [organizations.id],
  }),
  facility: one(facilities, {
    fields: [uploadedFiles.facilityId],
    references: [facilities.id],
  }),
  asset: one(assets, { fields: [uploadedFiles.assetId], references: [assets.id] }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrations.organizationId],
    references: [organizations.id],
  }),
}));

export const importJobsRelations = relations(importJobs, ({ one }) => ({
  organization: one(organizations, {
    fields: [importJobs.organizationId],
    references: [organizations.id],
  }),
  file: one(uploadedFiles, { fields: [importJobs.fileId], references: [uploadedFiles.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  actor: one(users, { fields: [auditLogs.actorUserId], references: [users.id] }),
}));

export const backgroundJobsRelations = relations(backgroundJobs, ({ one }) => ({
  organization: one(organizations, {
    fields: [backgroundJobs.organizationId],
    references: [organizations.id],
  }),
}));
