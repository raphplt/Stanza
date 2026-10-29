"use client";

import { useEffect, useRef } from "react";
import { recordPostViewAction } from "@/app/(public)/view-actions";

export function ViewTracker({ postId }: { postId: string }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    const timer = setTimeout(() => {
      recordPostViewAction({ postId }).catch(() => {});
    }, 1500);

    return () => clearTimeout(timer);
  }, [postId]);

  return null;
}
