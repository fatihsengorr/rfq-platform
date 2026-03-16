"use client";

import { useEffect } from "react";
import { toast } from "sonner";

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
          if (resolved.tone === "success") {
            toast.success(resolved.text);
          } else if (resolved.tone === "error") {
            toast.error(resolved.text);
          } else {
            toast.warning(resolved.text);
          }
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

  return null;
}
