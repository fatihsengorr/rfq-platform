import { randomBytes } from "node:crypto";

type LoginHandoff = {
  accessToken: string;
  expiresAt: number;
};

const HANDOFF_TTL_MS = 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __rfqLoginHandoffs: Map<string, LoginHandoff> | undefined;
}

function getStore() {
  if (!globalThis.__rfqLoginHandoffs) {
    globalThis.__rfqLoginHandoffs = new Map<string, LoginHandoff>();
  }

  return globalThis.__rfqLoginHandoffs;
}

function cleanupExpiredEntries(store: Map<string, LoginHandoff>) {
  const now = Date.now();

  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) {
      store.delete(key);
    }
  }
}

export function createLoginHandoff(accessToken: string) {
  const store = getStore();
  cleanupExpiredEntries(store);

  const nonce = randomBytes(24).toString("base64url");

  store.set(nonce, {
    accessToken,
    expiresAt: Date.now() + HANDOFF_TTL_MS
  });

  return nonce;
}

export function consumeLoginHandoff(nonce: string) {
  const store = getStore();
  cleanupExpiredEntries(store);

  const handoff = store.get(nonce) ?? null;

  if (!handoff) {
    return null;
  }

  store.delete(nonce);
  return handoff.accessToken;
}
