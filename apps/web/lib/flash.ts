import { cookies } from "next/headers";

const FLASH_COOKIE_NAME = "crm_flash_notice";

type FlashPayload = {
  path: string;
  code: string;
  createdAt: number;
};

export async function setFlashNotice(path: string, code: string): Promise<void> {
  const store = await cookies();
  const payload: FlashPayload = {
    path,
    code,
    createdAt: Date.now()
  };

  store.set(FLASH_COOKIE_NAME, encodeURIComponent(JSON.stringify(payload)), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60
  });
}

export function parseFlashPayload(raw: string | undefined): FlashPayload | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<FlashPayload>;

    if (!parsed.path || !parsed.code || typeof parsed.createdAt !== "number") {
      return null;
    }

    return {
      path: parsed.path,
      code: parsed.code,
      createdAt: parsed.createdAt
    };
  } catch {
    return null;
  }
}

export { FLASH_COOKIE_NAME };
