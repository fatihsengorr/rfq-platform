import { UserRole } from "@prisma/client";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import jwt from "jsonwebtoken";
import { ApiError } from "../../errors.js";
import { prisma } from "../../prisma.js";

const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "dev-secret-change-me";
const ACCESS_TOKEN_EXPIRES_IN = "12h";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;
const RESET_TOKEN_TTL_MINUTES = 30;
const RESET_TOKEN_LENGTH_BYTES = 32;
const scrypt = promisify(scryptCallback);
const ALLOW_LEGACY_PASSWORD_UPGRADE =
  (process.env.ALLOW_LEGACY_PASSWORD_UPGRADE ?? (process.env.NODE_ENV === "production" ? "false" : "true")) === "true";
const APP_WEB_BASE_URL = process.env.APP_WEB_BASE_URL ?? "http://localhost:3000";

if (process.env.NODE_ENV === "production" && (!process.env.AUTH_JWT_SECRET || process.env.AUTH_JWT_SECRET === "dev-secret-change-me")) {
  throw new Error("AUTH_JWT_SECRET must be set to a strong value in production.");
}

const LEGACY_PASSWORD_UPGRADE: Record<string, string> = {
  "sales@crm.local": "Pass123!",
  "pricing@crm.local": "Pass123!",
  "manager@crm.local": "Pass123!",
  "admin@crm.local": "Pass123!"
};

let bootstrapChecked = false;

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

type AuthTokenPayload = {
  sub: string;
  email: string;
  fullName: string;
  role: UserRole;
};

export type AuthSession = {
  user: AuthUser;
};

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 12) {
    return "Password must be at least 12 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character.";
  }

  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_LENGTH).toString("hex");
  const derivedKey = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

function hashResetToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, hashHex] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");
  const candidate = (await scrypt(password, salt, expected.length)) as Buffer;

  if (candidate.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(candidate, expected);
}

async function ensureBootstrapAdmin() {
  if (bootstrapChecked) {
    return;
  }

  bootstrapChecked = true;

  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: UserRole.ADMIN
    },
    select: { id: true }
  });

  if (existingAdmin) {
    return;
  }

  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
  const bootstrapName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Bootstrap Admin";

  if (!bootstrapEmail || !bootstrapPassword) {
    return;
  }

  const policyError = validatePasswordPolicy(bootstrapPassword);

  if (policyError) {
    console.warn(`BOOTSTRAP_ADMIN_PASSWORD policy violation: ${policyError}`);
    return;
  }

  const passwordHash = await hashPassword(bootstrapPassword);

  await prisma.user.create({
    data: {
      email: bootstrapEmail,
      fullName: bootstrapName,
      role: UserRole.ADMIN,
      isActive: true,
      passwordHash
    }
  });

  console.warn(`Bootstrap admin user created: ${bootstrapEmail}`);
}

async function maybeUpgradeLegacyPassword(
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    isActive: boolean;
    passwordHash: string | null;
  },
  rawPassword: string
) {
  if (!ALLOW_LEGACY_PASSWORD_UPGRADE) {
    return user;
  }

  if (user.passwordHash) {
    return user;
  }

  const legacyPassword = LEGACY_PASSWORD_UPGRADE[user.email];

  if (!legacyPassword || legacyPassword !== rawPassword) {
    return user;
  }

  const passwordHash = await hashPassword(rawPassword);

  return prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      passwordHash: true
    }
  });
}

export async function loginWithPassword(email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  await ensureBootstrapAdmin();

  const existing = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      passwordHash: true
    }
  });

  if (!existing) {
    throw new ApiError("UNAUTHORIZED", "Invalid email or password.", 401);
  }

  if (!existing.isActive) {
    throw new ApiError("FORBIDDEN", "Your account is inactive. Please contact administrator.", 403);
  }

  const user = await maybeUpgradeLegacyPassword(existing, password);

  if (!user.passwordHash) {
    throw new ApiError("UNAUTHORIZED", "Invalid email or password.", 401);
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);

  if (!isValidPassword) {
    throw new ApiError("UNAUTHORIZED", "Invalid email or password.", 401);
  }

  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN
  });

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    }
  };
}

export function extractBearerToken(authHeader: string | string[] | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const normalized = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  const [scheme, token] = normalized.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export function verifyAccessToken(token: string): AuthSession {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;

    if (!decoded?.sub || !decoded?.email || !decoded?.fullName || !decoded?.role) {
      throw new ApiError("UNAUTHORIZED", "Authentication token is malformed.", 401);
    }

    return {
      user: {
        id: decoded.sub,
        email: decoded.email,
        fullName: decoded.fullName,
        role: decoded.role
      }
    };
  } catch {
    throw new ApiError("UNAUTHORIZED", "Authentication token is invalid or expired.", 401);
  }
}

export async function resolveAccessToken(token: string): Promise<AuthSession> {
  const session = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true
    }
  });

  if (!user) {
    throw new ApiError("UNAUTHORIZED", "Authentication token is invalid or expired.", 401);
  }

  if (!user.isActive) {
    throw new ApiError("FORBIDDEN", "Your account is inactive. Please contact administrator.", 403);
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    }
  };
}

export async function issuePasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      isActive: true
    }
  });

  // Prevent account enumeration by always returning success.
  if (!user || !user.isActive) {
    return { success: true };
  }

  const rawToken = randomBytes(RESET_TOKEN_LENGTH_BYTES).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null
      },
      data: {
        usedAt: now
      }
    }),
    prisma.passwordResetToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId: user.id
      }
    })
  ]);

  const debugResetUrl = `${APP_WEB_BASE_URL}/reset-password?token=${rawToken}`;
  console.warn(`Password reset token issued for ${user.email}: ${debugResetUrl}`);

  if (process.env.NODE_ENV !== "production") {
    return { success: true, debugResetToken: rawToken, debugResetUrl };
  }

  return { success: true };
}

export async function resetPasswordWithToken(input: { token: string; newPassword: string }) {
  const token = input.token.trim();
  const now = new Date();

  if (!token) {
    throw new ApiError("INVALID_RESET_TOKEN", "Password reset token is invalid or expired.", 400);
  }

  const policyError = validatePasswordPolicy(input.newPassword);

  if (policyError) {
    throw new ApiError("WEAK_PASSWORD", policyError, 400);
  }

  const tokenHash = hashResetToken(token);

  const resetRecord = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: now
      }
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          passwordHash: true,
          isActive: true
        }
      }
    }
  });

  if (!resetRecord || !resetRecord.user.isActive) {
    throw new ApiError("INVALID_RESET_TOKEN", "Password reset token is invalid or expired.", 400);
  }

  if (resetRecord.user.passwordHash) {
    const sameAsCurrent = await verifyPassword(input.newPassword, resetRecord.user.passwordHash);

    if (sameAsCurrent) {
      throw new ApiError("INVALID_REQUEST", "New password must be different from current password.", 400);
    }
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash }
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: now }
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: resetRecord.userId,
        usedAt: null
      },
      data: {
        usedAt: now
      }
    })
  ]);

  return { success: true };
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
  const normalizedCurrent = currentPassword.trim();
  const normalizedNext = newPassword.trim();

  if (!normalizedCurrent || !normalizedNext) {
    throw new ApiError("INVALID_REQUEST", "Current password and new password are required.", 400);
  }

  const policyError = validatePasswordPolicy(normalizedNext);

  if (policyError) {
    throw new ApiError("WEAK_PASSWORD", policyError, 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
      isActive: true
    }
  });

  if (!user || !user.isActive || !user.passwordHash) {
    throw new ApiError("UNAUTHORIZED", "Current password is incorrect.", 401);
  }

  const currentValid = await verifyPassword(normalizedCurrent, user.passwordHash);

  if (!currentValid) {
    throw new ApiError("PASSWORD_MISMATCH", "Current password is incorrect.", 400);
  }

  const sameAsCurrent = await verifyPassword(normalizedNext, user.passwordHash);

  if (sameAsCurrent) {
    throw new ApiError("INVALID_REQUEST", "New password must be different from current password.", 400);
  }

  const passwordHash = await hashPassword(normalizedNext);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null
      },
      data: {
        usedAt: new Date()
      }
    })
  ]);

  return { success: true };
}
