import { describe, it, expect } from "vitest";
import { formatGlitchTipMessage } from "./glitchtip-webhook.js";

describe("formatGlitchTipMessage", () => {
  it("formats a typical error payload with all common fields", () => {
    const msg = formatGlitchTipMessage({
      action: "created",
      data: {
        issue: {
          title: "TypeError: Cannot read property 'foo' of undefined",
          culprit: "rfqStore.getById (rfq.store.ts:142)",
          level: "error",
          project: { name: "rfq-api", slug: "rfq-api" },
          web_url: "https://app.glitchtip.com/gorhan/issues/12",
          shortId: "RFQ-API-12",
          count: 3,
        },
      },
    });

    expect(msg).toContain("ERROR");
    expect(msg).toContain("rfq-api");
    expect(msg).toContain("TypeError: Cannot read property 'foo' of undefined");
    expect(msg).toContain("rfqStore.getById");
    expect(msg).toContain("RFQ-API-12");
    expect(msg).toContain("Seen: 3");
    expect(msg).toContain('href="https://app.glitchtip.com/gorhan/issues/12"');
  });

  it("escapes HTML so titles with <script> can't break formatting", () => {
    const msg = formatGlitchTipMessage({
      data: {
        issue: {
          title: "<script>alert('x')</script>",
          level: "error",
          project: "rfq-api",
        },
      },
    });
    expect(msg).not.toContain("<script>");
    expect(msg).toContain("&lt;script&gt;");
  });

  it("falls back gracefully when project is a bare string or missing", () => {
    const msg = formatGlitchTipMessage({
      data: {
        issue: {
          title: "boom",
          level: "fatal",
          project: "rfq-cron",
        },
      },
    });
    expect(msg).toContain("FATAL");
    expect(msg).toContain("rfq-cron");
  });

  it("uses generic message when payload is malformed", () => {
    const msg = formatGlitchTipMessage({});
    expect(msg).toContain("Unknown payload format");
  });

  // GlitchTip's Project → Alerts UI emits the Sentry classic "Alert Rule"
  // shape: flat fields at the root (no data.issue wrapper). Real-world
  // payload from a production webhook.
  it("formats Sentry classic Alert Rule shape (flat root fields)", () => {
    const msg = formatGlitchTipMessage({
      id: "12345",
      project: "rfq-api",
      project_name: "rfq-api",
      project_slug: "rfq-api",
      level: "error",
      culprit: "rfqStore.getById",
      message: "Faz 5 E2E test - alert rule webhook",
      url: "https://app.glitchtip.com/rfq-api/issues/12345",
      triggering_rules: ["My alert"],
      event: { event_id: "abc123", level: "error" },
    });
    expect(msg).toContain("ERROR");
    expect(msg).toContain("rfq-api");
    expect(msg).toContain("Faz 5 E2E test - alert rule webhook");
    expect(msg).toContain("rfqStore.getById");
    expect(msg).toContain("12345");
    expect(msg).toContain("https://app.glitchtip.com/rfq-api/issues/12345");
    expect(msg).not.toContain("Unknown payload format");
  });

  it("derives level from nested event when root has no level (classic shape)", () => {
    const msg = formatGlitchTipMessage({
      id: "1",
      project: "rfq-web",
      message: "boom",
      event: { event_id: "x", level: "warning" },
    });
    expect(msg).toContain("WARNING");
    expect(msg).toContain("⚠️");
  });

  it("falls back to error level when nothing specifies it", () => {
    const msg = formatGlitchTipMessage({
      id: "1",
      project: "p",
      message: "boom",
    });
    expect(msg).toContain("ERROR");
    expect(msg).toContain("❌");
  });

  it("picks an appropriate icon by level", () => {
    expect(formatGlitchTipMessage({ data: { issue: { title: "x", level: "warning", project: "p" } } })).toContain("⚠️");
    expect(formatGlitchTipMessage({ data: { issue: { title: "x", level: "fatal", project: "p" } } })).toContain("🚨");
    expect(formatGlitchTipMessage({ data: { issue: { title: "x", level: "info", project: "p" } } })).toContain("ℹ️");
  });
});
