"use client";

import { useEffect } from "react";
import { setTimezoneAction } from "@/app/actions";

export function TimezoneBootstrap({ current }: { current: string }) {
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && detected !== current) {
      setTimezoneAction(detected).catch(() => {});
    }
  }, [current]);
  return null;
}
