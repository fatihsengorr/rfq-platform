/**
 * Formats a GlitchTip alert webhook payload into a compact Telegram
 * message. GlitchTip's webhook shape is the Sentry-compatible alert
 * payload — issue title, level, project, link, count, etc.
 *
 * We don't claim to handle every Sentry payload field — just the ones
 * GlitchTip actually sends, with safe fallbacks.
 */

import { escapeHtml } from "./telegram.service.js";

// Sentry/GlitchTip webhook shape. We typecheck what we actually use;
// the rest is `unknown`.
export type GlitchTipPayload = {
  action?: string;
  data?: {
    issue?: {
      title?: string;
      culprit?: string;
      level?: string;
      project?: string | { name?: string; slug?: string };
      web_url?: string | null;
      permalink?: string | null;
      shortId?: string;
      short_id?: string;
      count?: number | string;
      userCount?: number | string;
      // Some payloads ship the project as a sibling field.
      project_name?: string;
    };
    // Some GlitchTip versions wrap the issue under "issue" or "event"
    event?: Record<string, unknown>;
  };
};

const LEVEL_ICON: Record<string, string> = {
  fatal: "🚨",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  debug: "🐛",
};

function readProject(issue: NonNullable<NonNullable<GlitchTipPayload["data"]>["issue"]>): string {
  if (typeof issue.project === "string") return issue.project;
  if (issue.project && typeof issue.project === "object") {
    return issue.project.name ?? issue.project.slug ?? "unknown";
  }
  return issue.project_name ?? "unknown";
}

export function formatGlitchTipMessage(payload: GlitchTipPayload): string {
  const issue = payload.data?.issue;
  if (!issue) {
    return `<b>GlitchTip alert</b>\nUnknown payload format`;
  }

  const level = (issue.level ?? "error").toLowerCase();
  const icon = LEVEL_ICON[level] ?? "❌";
  const project = readProject(issue);
  const title = issue.title ?? "(no title)";
  const culprit = issue.culprit ?? "";
  const url = issue.web_url ?? issue.permalink ?? "";
  const shortId = issue.shortId ?? issue.short_id ?? "";
  const count = issue.count ?? "";

  const lines: string[] = [
    `${icon} <b>${escapeHtml(level.toUpperCase())}</b> in <code>${escapeHtml(project)}</code>`,
    `<b>${escapeHtml(title)}</b>`,
  ];
  if (culprit) lines.push(`<i>${escapeHtml(culprit)}</i>`);
  if (count) lines.push(`Seen: ${escapeHtml(String(count))} times`);
  if (shortId) lines.push(`ID: <code>${escapeHtml(shortId)}</code>`);
  if (url) lines.push(`<a href="${escapeHtml(url)}">Open in GlitchTip</a>`);

  return lines.join("\n");
}
