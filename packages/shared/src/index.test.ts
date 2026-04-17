import { describe, it, expect } from "vitest";
import {
  CURRENCIES,
  USER_ROLES,
  RFQ_STATUSES,
  RESOLVED_RFQ_STATUSES,
  isResolvedStatus,
  IDLE_RESULT,
} from "./index.js";

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

  it("exports 9 RFQ statuses including WON/LOST outcome", () => {
    expect(RFQ_STATUSES).toHaveLength(9);
    expect(RFQ_STATUSES).toContain("NEW");
    expect(RFQ_STATUSES).toContain("CLOSED");
    expect(RFQ_STATUSES).toContain("WON");
    expect(RFQ_STATUSES).toContain("LOST");
  });

  it("marks WON/LOST/CLOSED as resolved terminal statuses", () => {
    expect(RESOLVED_RFQ_STATUSES).toEqual(["WON", "LOST", "CLOSED"]);
    expect(isResolvedStatus("WON")).toBe(true);
    expect(isResolvedStatus("LOST")).toBe(true);
    expect(isResolvedStatus("CLOSED")).toBe(true);
    expect(isResolvedStatus("QUOTED")).toBe(false);
    expect(isResolvedStatus("NEW")).toBe(false);
  });

  it("IDLE_RESULT has correct shape", () => {
    expect(IDLE_RESULT).toEqual({ status: "idle", message: "" });
  });
});
