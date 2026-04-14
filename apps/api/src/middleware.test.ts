import { describe, it, expect, vi } from "vitest";
import { sendError, extractRequestToken } from "./middleware.js";
import { ApiError } from "./errors.js";

// Mock auth.service so we don't need a real database
vi.mock("./modules/auth/auth.service.js", () => ({
  extractBearerToken: (header: string | string[] | undefined) => {
    if (typeof header === "string" && header.startsWith("Bearer ")) {
      return header.slice(7);
    }
    return null;
  },
  extractSessionTokenFromCookie: (cookie: string | undefined) => {
    if (!cookie) return null;
    const match = cookie.match(/session_token=([^;]+)/);
    return match ? match[1] : null;
  },
  resolveAccessToken: vi.fn(),
}));

function mockReply() {
  const sent = { status: 0, body: null as unknown };
  return {
    status(code: number) {
      sent.status = code;
      return {
        send(body: unknown) {
          sent.body = body;
          return body;
        },
      };
    },
    _sent: sent,
  };
}

describe("sendError", () => {
  it("serializes ApiError with correct status and code", () => {
    const reply = mockReply();
    sendError(reply, new ApiError("UNAUTHORIZED", "Token expired", 401));
    expect(reply._sent.status).toBe(401);
    expect(reply._sent.body).toEqual({ code: "UNAUTHORIZED", message: "Token expired" });
  });

  it("returns 500 for non-ApiError", () => {
    const reply = mockReply();
    sendError(reply, new Error("something broke"));
    expect(reply._sent.status).toBe(500);
    expect(reply._sent.body).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred.",
    });
  });

  it("returns 500 for null/undefined errors", () => {
    const reply = mockReply();
    sendError(reply, null);
    expect(reply._sent.status).toBe(500);
  });
});

describe("extractRequestToken", () => {
  it("extracts Bearer token from Authorization header", () => {
    const request = { headers: { authorization: "Bearer abc123" } };
    expect(extractRequestToken(request)).toBe("abc123");
  });

  it("extracts session token from cookie", () => {
    const request = { headers: { cookie: "session_token=xyz789; other=val" } };
    expect(extractRequestToken(request)).toBe("xyz789");
  });

  it("prefers Bearer token over cookie", () => {
    const request = {
      headers: {
        authorization: "Bearer from_header",
        cookie: "session_token=from_cookie",
      },
    };
    expect(extractRequestToken(request)).toBe("from_header");
  });

  it("returns null when no token is present", () => {
    const request = { headers: {} };
    expect(extractRequestToken(request)).toBeNull();
  });
});
