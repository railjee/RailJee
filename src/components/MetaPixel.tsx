"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  captureAttribution,
  firePendingRegistration,
  initPixel,
  trackPageView,
} from "@/lib/metaTracking";

/**
 * Loads the Meta Pixel and tracks one PageView per route. All logic lives in
 * @/lib/metaTracking; see docs/plans/2026-10-29-meta-conversion-tracking.md.
 */
export default function MetaPixel() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    // Store UTMs / fbclid even when tracking is off, so they still reach the signup call.
    captureAttribution();

    if (!initPixel()) return;

    // Browser copy of a Google signup (the OAuth callback set the rj_reg cookie).
    firePendingRegistration();

    // Pathname only: query-string changes (filters, ?dept=) are not new pages.
    if (lastTrackedPath.current !== pathname) {
      trackPageView();
      lastTrackedPath.current = pathname;
    }
  }, [pathname]);

  return null;
}
