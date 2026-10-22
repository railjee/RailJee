"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type FbqFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

export default function MetaPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const lastTrackedUrl = useRef<string | null>(null);

  useEffect(() => {
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

    if (!pixelId) return;

    // Initialise the Pixel once, then load Meta's script.
    if (!window.fbq) {
      const fbq = function (...args: unknown[]) {
        if (fbq.callMethod) {
          fbq.callMethod(...args);
        } else {
          fbq.queue?.push(args);
        }
      } as FbqFunction;

      fbq.queue = [];
      fbq.loaded = true;
      fbq.version = "2.0";

      window.fbq = fbq;
      window._fbq = fbq;

      window.fbq("init", pixelId);

      if (!document.getElementById("meta-pixel-script")) {
        const script = document.createElement("script");
        script.id = "meta-pixel-script";
        script.async = true;
        script.src = "https://connect.facebook.net/en_US/fbevents.js";
        document.head.appendChild(script);
      }
    }

    // Registration can finish before this effect initializes the Pixel.
    // Flush events queued by the signup page once the fbq stub is available.
    const pendingEvents = window.sessionStorage.getItem("meta-pixel-pending-events");
    if (pendingEvents) {
      try {
        const events = JSON.parse(pendingEvents) as string[];
        for (const eventName of events) {
          window.fbq?.("track", eventName);
        }
        window.sessionStorage.removeItem("meta-pixel-pending-events");
      } catch {
        window.sessionStorage.removeItem("meta-pixel-pending-events");
      }
    }

    // Track the initial page and subsequent App Router navigations.
    const currentUrl = pathname + (query ? `?${query}` : "");

    if (lastTrackedUrl.current !== currentUrl) {
      window.fbq?.("track", "PageView");
      lastTrackedUrl.current = currentUrl;
    }
  }, [pathname, query]);

  return null;
}
