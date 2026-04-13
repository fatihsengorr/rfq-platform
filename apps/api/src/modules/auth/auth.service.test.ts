import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "./auth.service.js";

describe("validatePasswordPolicy", () => {
  it("rejects passwords shorter than 12 characters", () => {
    expect(validatePasswordPolicy("Short1!")).not.toBeNull();
  });

  it("rejects passwords without uppercase", () => {
    expect(validatePasswordPolicy("lowercase1234!")).not.toBeNull();
  });

  it("rejects passwords without lowercase", () => {
    expect(validatePasswordPolicy("UPPERCASE1234!")).not.toBeNull();
  });

  it("rejects passwords without a number", () => {
    expect(validatePasswordPolicy("NoNumbers!Here")).not.toBeNull();
  });

  it("rejects passwords without a special character", () => {
    expect(validatePasswordPolicy("NoSpecial12345")).not.toBeNull();
  });

  it("accepts a strong password", () => {
    expect(validatePasswordPolicy("StrongPass123!")).toBeNull();
  });
});

describe("hashPassword / verifyPassword", () => {
  it("hashes and verifies correctly", async () => {
    const password = "TestPassword123!";
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^scrypt\$/);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("CorrectPass123!");
    expect(await verifyPassword("WrongPassword123!", hash)).toBe(false);
  });

  it("produces unique hashes (different salts)", async () => {
    const password = "SamePassword123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });
});
