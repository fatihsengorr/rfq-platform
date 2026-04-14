import { UserRole } from "@prisma/client";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ApiError } from "../../errors.js";
import { config } from "../../config.js";
import { logger } from "../../logger.js";
import { prisma } from "../../prisma.js";
import { sendNotification } from "../email/email.service.js";
import { passwordResetNotification, inviteUserNotification } from "../email/email.templates.js";

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;
const RESET_TOKEN_TTL_MINUTES = 30;
const INVITE_TOKEN_TTL_HOURS = 48;
const RESET_TOKEN_LENGTH_BYTES = 32;
const SESSION_TTL_HOURS = 12;
const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE_NAME = "rfq_session";

let bootstrapChecked = false;

export type AuthUser = {
  id: string;
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

function hashSessionToken(rawToken: string) {
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

  const bootstrapEmail = config.bootstrap.email;
  const bootstrapPassword = config.bootstrap.password;
  const bootstrapName = config.bootstrap.name;

  if (!bootstrapEmail || !bootstrapPassword) {
    return;
  }

  const policyError = validatePasswordPolicy(bootstrapPassword);

  if (policyError) {
    logger.warn(`BOOTSTRAP_ADMIN_PASSWORD policy violation: ${policyError}`);
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

  logger.warn(`Bootstrap admin user created: ${bootstrapEmail}`);
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

  if (!existing.passwordHash) {
    throw new ApiError("UNAUTHORIZED", "Invalid email or password.", 401);
  }

  const isValidPassword = await verifyPassword(password, existing.passwordHash);

  if (!isValidPassword) {
    throw new ApiError("UNAUTHORIZED", "Invalid email or password.", 401);
  }

  const accessToken = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(accessToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      tokenHash,
      expiresAt,
      userId: existing.id
    }
  });

  return {
    accessToken,
    user: {
      id: existing.id,
      email: existing.email,
      fullName: existing.fullName,
      role: existing.role
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

export function extractSessionTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");

    if (rawName !== SESSION_COOKIE_NAME || rest.length === 0) {
      continue;
    }

    return rest.join("=");
  }

  return null;
}

export async function resolveAccessToken(token: string): Promise<AuthSession> {
  const tokenHash = hashSessionToken(token);
  const now = new Date();

  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: now
      }
    },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true
        }
      }
    }
  });

  if (!session?.user) {
    throw new ApiError("UNAUTHORIZED", "Authentication token is invalid or expired.", 401);
  }

  if (!session.user.isActive) {
    throw new ApiError("FORBIDDEN", "Your account is inactive. Please contact administrator.", 403);
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role
    }
  };
}

export async function revokeAccessToken(token: string) {
  const tokenHash = hashSessionToken(token);

  await prisma.session.updateMany({
    where: {
      tokenHash,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}

export async function issuePasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      fullName: true,
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
        purpose: "reset",
        userId: user.id
      }
    })
  ]);

  const resetUrl = `${config.webBaseUrl}/reset-password?token=${rawToken}`;
  logger.warn(`Password reset token issued for ${user.email}: ${resetUrl}`);

  // Send password reset email (fire-and-forget)
  const { subject, html } = passwordResetNotification(user.fullName, resetUrl, RESET_TOKEN_TTL_MINUTES);
  sendNotification({
    type: "PASSWORD_RESET",
    recipientId: user.id,
    recipientEmail: user.email,
    subject,
    html,
  }).catch((err) => logger.error({ err }, "Failed to send password reset email"));

  if (!config.isProd) {
    return { success: true, debugResetToken: rawToken, debugResetUrl: resetUrl };
  }

  return { success: true };
}

export async function issueInviteToken(userId: string, invitedByName: string) {
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      isActive: true
    }
  });

  if (!user) {
    throw new ApiError("USER_NOT_FOUND", "User not found.", 404);
  }

  const rawToken = randomBytes(RESET_TOKEN_LENGTH_BYTES).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(now.getTime() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000);

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
        purpose: "invite",
        userId: user.id
      }
    })
  ]);

  const setPasswordUrl = `${config.webBaseUrl}/set-password?token=${rawToken}`;
  logger.warn(`Invite token issued for ${user.email}: ${setPasswordUrl}`);

  // Send invite email (fire-and-forget)
  const { subject, html } = inviteUserNotification(user.fullName, invitedByName, setPasswordUrl, INVITE_TOKEN_TTL_HOURS);
  sendNotification({
    type: "USER_INVITE",
    recipientId: user.id,
    recipientEmail: user.email,
    subject,
    html,
  }).catch((err) => logger.error({ err }, "Failed to send invite email"));

  if (!config.isProd) {
    return { success: true, debugToken: rawToken, debugUrl: setPasswordUrl };
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
