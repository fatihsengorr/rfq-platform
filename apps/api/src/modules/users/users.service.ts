import { Prisma, UserRole } from "@prisma/client";
import { ApiError } from "../../errors.js";
import { logger } from "../../logger.js";
import { prisma } from "../../prisma.js";
import { hashPassword, validatePasswordPolicy, issueInviteToken } from "../auth/auth.service.js";

// ── Types ──────────────────────────────────────────────────────────

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  passwordResetTokens?: Array<{
    purpose: string;
    expiresAt: Date;
    usedAt: Date | null;
  }>;
};

export type MappedUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  hasPassword: boolean;
  inviteStatus: "none" | "pending" | "expired";
  createdAt: string;
  updatedAt: string;
};

// ── Shared select clause ───────────────────────────────────────────

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  passwordHash: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ── Helpers ────────────────────────────────────────────────────────

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapUser(user: UserRow): MappedUser {
  const hasPassword = !!user.passwordHash;

  let inviteStatus: "none" | "pending" | "expired" = "none";
  if (!hasPassword && user.passwordResetTokens) {
    const now = new Date();
    const inviteTokens = user.passwordResetTokens.filter((t) => t.purpose === "invite");
    if (inviteTokens.length > 0) {
      const hasUnusedValid = inviteTokens.some((t) => !t.usedAt && t.expiresAt > now);
      inviteStatus = hasUnusedValid ? "pending" : "expired";
    } else {
      inviteStatus = "expired";
    }
  } else if (!hasPassword) {
    inviteStatus = "expired";
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    hasPassword,
    inviteStatus,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

// ── Service functions ──────────────────────────────────────────────

export async function listUsers(): Promise<MappedUser[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
    take: 500,
    select: {
      ...userSelect,
      passwordResetTokens: {
        where: { purpose: "invite" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { purpose: true, expiresAt: true, usedAt: true },
      },
    },
  });

  return users.map(mapUser);
}

export async function createUser(
  data: { email: string; fullName: string; role: UserRole; password?: string; isActive: boolean },
  invitedByName: string
): Promise<MappedUser> {
  let passwordHash: string | null = null;

  if (data.password) {
    const policyError = validatePasswordPolicy(data.password);
    if (policyError) {
      throw new ApiError("WEAK_PASSWORD", policyError, 400);
    }
    passwordHash = await hashPassword(data.password);
  }

  try {
    const created = await prisma.user.create({
      data: {
        email: normalizeEmail(data.email),
        fullName: data.fullName.trim(),
        role: data.role,
        isActive: data.isActive,
        passwordHash,
      },
      select: userSelect,
    });

    if (!data.password) {
      issueInviteToken(created.id, invitedByName).catch((err) =>
        logger.error({ err }, "Failed to issue invite token")
      );
    }

    return mapUser(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError("USER_EMAIL_EXISTS", "Email is already in use.", 409);
    }
    throw error;
  }
}

export async function updateRole(userId: string, role: UserRole): Promise<MappedUser> {
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: userSelect,
    });
    return mapUser(updated);
  } catch {
    throw new ApiError("USER_NOT_FOUND", "User not found.", 404);
  }
}

export async function updateActive(userId: string, isActive: boolean): Promise<MappedUser> {
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: userSelect,
    });
    return mapUser(updated);
  } catch {
    throw new ApiError("USER_NOT_FOUND", "User not found.", 404);
  }
}

export async function updatePassword(userId: string, password: string): Promise<void> {
  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    throw new ApiError("WEAK_PASSWORD", policyError, 400);
  }

  try {
    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  } catch {
    throw new ApiError("USER_NOT_FOUND", "User not found.", 404);
  }
}
