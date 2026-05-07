/**
 * Formats a GlitchTip alert webhook payload into a compact Telegram
 * message.
 *
 * GlitchTip ships TWO webhook shapes depending on which alert mechanism
 * fires it:
 *   1. Sentry "Internal Integration" / Issue Alert (newer Sentry shape)
 *      — wraps everything under `{ action, data: { issue: {...} } }`.
 *   2. Sentry classic "Alert Rule" webhook (the one GlitchTip's own
 *      Project → Alerts UI emits) — flat fields at the root:
 *      `{ id, project, project_name, level, culprit, message, url,
 *         triggering_rules: [...], event: {...} }`.
 *
 * We accept both, normalise into the same shape, and format. Anything we
 * can't recognise falls back to a generic alert line so we don't drop
 * the message silently.
 */

import { escapeHtml } from "./telegram.service.js";

// Loose type — we only typecheck the fields we actually read.
export type GlitchTipPayload = {
  // Newer "internal integration" shape
  action?: string;
  data?: {
    issue?: WebhookIssueLike;
    event?: Record<string, unknown>;
  };
  // Classic "Alert Rule" shape — flat fields at root
  id?: string;
  project?: string | { name?: string; slug?: string };
  project_name?: string;
  project_slug?: string;
  level?: string;
  culprit?: string;
  message?: string;
  title?: string;
  url?: string;
  web_url?: string;
  permalink?: string;
  shortId?: string;
  short_id?: string;
  count?: number | string;
  triggering_rules?: string[];
  event?: { event_id?: string; level?: string };
};

type WebhookIssueLike = {
  title?: string;
  culprit?: string;
  level?: string;
  project?: string | { name?: string; slug?: string };
  project_name?: string;
  web_url?: string | null;
  permalink?: string | null;
  url?: string | null;
  shortId?: string;
  short_id?: string;
  count?: number | string;
  userCount?: number | string;
};

type Normalised = {
  level: string;
  project: string;
  title: string;
  culprit: string;
  url: string;
  shortId: string;
  count: string | number;
};

const LEVEL_ICON: Record<string, string> = {
  fatal: "🚨",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  debug: "🐛",
};

function readProject(p: WebhookIssueLike | GlitchTipPayload): string {
  const proj = p.project;
  if (typeof proj === "string") return proj;
  if (proj && typeof proj === "object") {
    return proj.name ?? proj.slug ?? "unknown";
  }
  // Both shapes can have a sibling project_name / project_slug field.
  return p.project_name ?? (p as GlitchTipPayload).project_slug ?? "unknown";
}

function normalise(payload: GlitchTipPayload): Normalised | null {
  // Shape 1: { data: { issue: {...} } }
  if (payload.data?.issue) {
    const issue = payload.data.issue;
    return {
      level: (issue.level ?? "error").toLowerCase(),
      project: readProject(issue),
      title: issue.title ?? "(no title)",
      culprit: issue.culprit ?? "",
      url: issue.web_url ?? issue.permalink ?? issue.url ?? "",
      shortId: issue.shortId ?? issue.short_id ?? "",
      count: issue.count ?? "",
    };
  }

  // Shape 2: flat fields at root.
  // Heuristic: must have some signal that this is an alert payload.
  if (payload.message || payload.title || payload.culprit || payload.url || payload.id) {
    return {
      level: (payload.level ?? payload.event?.level ?? "error").toLowerCase(),
      project: readProject(payload),
      title: payload.message ?? payload.title ?? "(no title)",
      culprit: payload.culprit ?? "",
      url: payload.url ?? payload.web_url ?? payload.permalink ?? "",
      shortId: payload.shortId ?? payload.short_id ?? payload.id ?? "",
      count: payload.count ?? "",
    };
  }

  return null;
}

export function formatGlitchTipMessage(payload: GlitchTipPayload): string {
  const n = normalise(payload);
  if (!n) {
    return `<b>GlitchTip alert</b>\nUnknown payload format`;
  }

  const icon = LEVEL_ICON[n.level] ?? "❌";

  const lines: string[] = [
    `${icon} <b>${escapeHtml(n.level.toUpperCase())}</b> in <code>${escapeHtml(n.project)}</code>`,
    `<b>${escapeHtml(n.title)}</b>`,
  ];
  if (n.culprit) lines.push(`<i>${escapeHtml(n.culprit)}</i>`);
  if (n.count) lines.push(`Seen: ${escapeHtml(String(n.count))} times`);
  if (n.shortId) lines.push(`ID: <code>${escapeHtml(n.shortId)}</code>`);
  if (n.url) lines.push(`<a href="${escapeHtml(n.url)}">Open in GlitchTip</a>`);

  return lines.join("\n");
}
