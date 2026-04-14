import { describe, it, expect } from "vitest";
import { ApiError, isApiError } from "./errors.js";

describe("ApiError", () => {
  it("creates an error with code, message, and status", () => {
    const err = new ApiError("UNAUTHORIZED", "Not authenticated", 401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Not authenticated");
    expect(err.status).toBe(401);
    expect(err).toBeInstanceOf(Error);
  });

  it("is detected by isApiError", () => {
    const apiErr = new ApiError("FORBIDDEN", "Access denied", 403);
    const plainErr = new Error("plain");

    expect(isApiError(apiErr)).toBe(true);
    expect(isApiError(plainErr)).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError("string")).toBe(false);
  });
});
