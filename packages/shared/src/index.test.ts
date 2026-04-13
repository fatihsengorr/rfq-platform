import { describe, it, expect } from "vitest";
import { CURRENCIES, USER_ROLES, RFQ_STATUSES, IDLE_RESULT } from "./index.js";

describe("shared constants", () => {
  it("exports 4 currencies", () => {
    expect(CURRENCIES).toHaveLength(4);
    expect(CURRENCIES).toContain("GBP");
    expect(CURRENCIES).toContain("TRY");
  });

  it("exports 4 user roles", () => {
    expect(USER_ROLES).toHaveLength(4);
    expect(USER_ROLES).toContain("ADMIN");
    expect(USER_ROLES).toContain("LONDON_SALES");
  });

  it("exports 7 RFQ statuses", () => {
    expect(RFQ_STATUSES).toHaveLength(7);
    expect(RFQ_STATUSES).toContain("NEW");
    expect(RFQ_STATUSES).toContain("CLOSED");
  });

  it("IDLE_RESULT has correct shape", () => {
    expect(IDLE_RESULT).toEqual({ status: "idle", message: "" });
  });
});
