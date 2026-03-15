"use client";

import { useEffect, useState } from "react";

type NoticeTone = "success" | "warn" | "error";

type NoticeDefinition = {
  tone: NoticeTone;
  text: string;
};

type FlashNoticeProps = {
  path: string;
  notices: Record<string, NoticeDefinition>;
};

export function FlashNotice({ path, notices }: FlashNoticeProps) {
  const [notice, setNotice] = useState<NoticeDefinition | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(`/api/flash/consume?path=${encodeURIComponent(path)}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { code: string | null };

        if (!active || !payload.code) {
          return;
        }

        const resolved = notices[payload.code];

        if (resolved) {
          setNotice(resolved);
        }
      } catch {
        // Ignore flash-fetch errors in UI.
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [notices, path]);

  if (!notice) {
    return null;
  }

  return <p className={`notice notice-${notice.tone}`}>{notice.text}</p>;
}
