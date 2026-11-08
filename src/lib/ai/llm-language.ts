import { parseInsightLanguage, type InsightDraft } from "./insight-schema";

export type LanguageEnrichmentResult = {
  drafts: InsightDraft[];
  enriched: boolean;
  rejected: boolean;
};

/**
 * Rephrases rule text only. Financial fields on the drafts are never replaced.
 * With no API key the provider does not call the network.
 */
export async function enrichInsightLanguage(
  drafts: InsightDraft[],
  options: {
    apiKey?: string | null;
    endpoint?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<LanguageEnrichmentResult> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) return { drafts, enriched: false, rejected: false };
  if (drafts.length === 0) return { drafts, enriched: false, rejected: false };

  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? "https://api.openai.com/v1/chat/completions";
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Rephrase insight title, description, and recommendedAction. Do not add numbers, savings, or extra fields. Return JSON { insights: [{ ruleId, title, description, recommendedAction }] }.",
          },
          {
            role: "user",
            content: JSON.stringify(
              drafts.map((item) => ({
                ruleId: item.ruleId,
                title: item.title,
                description: item.description,
                recommendedAction: item.recommendedAction,
              })),
            ),
          },
        ],
      }),
    });
    if (!response.ok) return { drafts, enriched: false, rejected: true };
    const body: unknown = await response.json();
    const content = readMessageContent(body);
    const parsedJson: unknown = content ? JSON.parse(content) : null;
    return applyInsightLanguage(drafts, parsedJson);
  } catch {
    return { drafts, enriched: false, rejected: true };
  }
}

export function applyInsightLanguage(
  drafts: InsightDraft[],
  raw: unknown,
): LanguageEnrichmentResult {
  const parsed = parseInsightLanguage(raw);
  if (!parsed.success) return { drafts, enriched: false, rejected: true };
  const byRule = new Map(parsed.data.insights.map((item) => [item.ruleId, item]));
  const next = drafts.map((item) => {
    const language = byRule.get(item.ruleId);
    if (!language) return item;
    return {
      ...item,
      title: language.title,
      description: language.description,
      recommendedAction: language.recommendedAction,
    };
  });
  return { drafts: next, enriched: true, rejected: false };
}

function readMessageContent(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}
