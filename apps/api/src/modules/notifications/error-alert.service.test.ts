import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Telegram sender so no real network call happens, and we can
// count how many alerts actually get dispatched.
const mockSend = vi.fn((_text: string) => Promise.resolve({ ok: true as const }));
vi.mock("./telegram.service.js", () => ({
  sendTelegramMessage: (text: string) => mockSend(text),
  escapeHtml: (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
}));

// Telegram must read as "enabled" for alertError to do anything.
vi.mock("../../config.js", () => ({
  config: {
    telegram: { enabled: true, botToken: "x", chatId: "y" },
    sentry: { environment: "test" },
  },
}));

vi.mock("../../logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { alertError, __resetAlertStateForTests } from "./error-alert.service.js";

const baseInput = {
  status: 500,
  route: "/api/rfqs/:id",
  method: "GET",
  errorName: "TypeError",
  message: "Cannot read property 'x' of undefined",
};

describe("alertError de-duplication", () => {
  beforeEach(() => {
    mockSend.mockClear();
    __resetAlertStateForTests();
  });

  it("sends a Telegram alert on first occurrence", async () => {
    alertError(baseInput);
    // alertError fires send() as a floating promise; flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("suppresses repeats of the same fingerprint within cooldown", async () => {
    alertError(baseInput);
    alertError(baseInput);
    alertError(baseInput);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("treats different routes as distinct fingerprints", async () => {
    alertError(baseInput);
    alertError({ ...baseInput, route: "/api/companies/:id" });
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("treats different error names as distinct fingerprints", async () => {
    alertError(baseInput);
    alertError({ ...baseInput, errorName: "RangeError" });
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("treats a different first line of message as distinct", async () => {
    alertError(baseInput);
    alertError({ ...baseInput, message: "totally different failure" });
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("includes the error name and route in the message", async () => {
    alertError(baseInput);
    await Promise.resolve();
    await Promise.resolve();
    const firstCall = mockSend.mock.calls[0];
    if (!firstCall) throw new Error("sendTelegramMessage was not called");
    const sentText = firstCall[0];
    expect(sentText).toContain("TypeError");
    expect(sentText).toContain("/api/rfqs/:id");
    expect(sentText).toContain("500");
  });
});
