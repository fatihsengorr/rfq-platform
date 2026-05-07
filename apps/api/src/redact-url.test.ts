import { describe, it, expect } from "vitest";
import { redactUrl } from "./server.js";

describe("redactUrl", () => {
  it("redacts token query parameter", () => {
    expect(redactUrl("/api/notifications/glitchtip?token=secret123"))
      .toBe("/api/notifications/glitchtip?token=[redacted]");
  });

  it("redacts access_token and api_key", () => {
    expect(redactUrl("/x?access_token=abc")).toBe("/x?access_token=[redacted]");
    expect(redactUrl("/x?api_key=def")).toBe("/x?api_key=[redacted]");
  });

  it("preserves other query params", () => {
    expect(redactUrl("/x?page=1&token=secret&limit=10"))
      .toBe("/x?page=1&token=[redacted]&limit=10");
  });

  it("handles URL fragments (# stops the redaction)", () => {
    expect(redactUrl("/x?token=abc#frag"))
      .toBe("/x?token=[redacted]#frag");
  });

  it("is case-insensitive on the parameter name", () => {
    expect(redactUrl("/x?TOKEN=abc")).toBe("/x?TOKEN=[redacted]");
    expect(redactUrl("/x?Access_Token=abc")).toBe("/x?Access_Token=[redacted]");
  });

  it("leaves URLs without sensitive params untouched", () => {
    expect(redactUrl("/api/rfqs/123?page=1")).toBe("/api/rfqs/123?page=1");
  });

  it("returns empty string for undefined", () => {
    expect(redactUrl(undefined)).toBe("");
  });
});
