/**
 * Meta Pixel tracking helper
 *
 * The one place that talks to the Meta Pixel (`window.fbq`). Components call
 * these functions instead of `window.fbq` directly, so internal-traffic
 * exclusion, event ids and attribution work the same everywhere.
 *
 * Usage (client components):
 *   import { trackViewContent } from '@/lib/metaTracking';
 *   trackViewContent({ contentIds: [paperId], contentCategory: 'civil', contentName: 'CCTS Mock 1' });
 *
 * Every function is a safe no-op on the server, when the Pixel ID is not set,
 * when NEXT_PUBLIC_TRACKING_DISABLED=true, or when the browser is flagged
 * internal (visit any page with ?rj_internal=1; ?rj_internal=0 clears it).
 *
 * Plan: docs/plans/2026-10-29-meta-conversion-tracking.md
 */

export type FbqFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
  disablePushState?: boolean;
};

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const TRACKING_DISABLED = process.env.NEXT_PUBLIC_TRACKING_DISABLED === 'true';

/** Cookie names shared with the server (OAuth callback route). */
export const ATTRIBUTION_COOKIE = 'rj_attr';
export const INTERNAL_COOKIE = 'rj_internal';
export const PENDING_REGISTRATION_COOKIE = 'rj_reg';

const INTERNAL_PARAM = 'rj_internal';
const ATTRIBUTION_MAX_AGE = 90 * 24 * 60 * 60; // 90 days
const INTERNAL_MAX_AGE = 365 * 24 * 60 * 60; // 1 year
const MAX_VALUE_LENGTH = 200;

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
] as const;

type UtmKey = (typeof UTM_KEYS)[number];

export type Attribution = Partial<Record<UtmKey, string>> & {
  fbclid?: string;
  /** Meta click id cookie value, `fb.1.<ms>.<fbclid>`. */
  fbc?: string;
  /** Meta browser id cookie value, `fb.1.<ms>.<random>`. */
  fbp?: string;
  /** Path (with query) of the first page the visitor landed on. */
  landingPage?: string;
  /** ISO time of the first landing. */
  firstSeenAt?: string;
};

// ── Cookies ──────────────────────────────────────────────────────────────

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const prefix = `${name}=`;
  const match = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function deleteCookie(name: string): void {
  writeCookie(name, '', 0);
}

// ── Internal traffic ─────────────────────────────────────────────────────

/** Set or clear the internal flag from `?rj_internal=1` / `?rj_internal=0`. */
export function applyInternalFlagFromUrl(): void {
  if (typeof window === 'undefined') return;
  const value = new URLSearchParams(window.location.search).get(INTERNAL_PARAM);
  if (value === '1') writeCookie(INTERNAL_COOKIE, '1', INTERNAL_MAX_AGE);
  if (value === '0') deleteCookie(INTERNAL_COOKIE);
}

/** True when this browser is flagged as our own (team/testing) traffic. */
export function isInternal(): boolean {
  applyInternalFlagFromUrl();
  return readCookie(INTERNAL_COOKIE) === '1';
}

function isTrackingEnabled(): boolean {
  return typeof window !== 'undefined' && !!PIXEL_ID && !TRACKING_DISABLED && !isInternal();
}

// ── Pixel ────────────────────────────────────────────────────────────────

/**
 * Load the Pixel once. Safe to call many times. Returns false when tracking
 * is off, so callers can skip work.
 */
export function initPixel(): boolean {
  if (!isTrackingEnabled()) return false;
  if (window.fbq) return true;

  // Same stub as Meta's base code: calls queue until fbevents.js loads.
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue?.push(args);
    }
  } as FbqFunction;

  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  // Stop fbevents.js from firing its own PageView on history.pushState.
  // We fire PageView ourselves on route change; without this, every
  // client-side navigation counts twice.
  fbq.disablePushState = true;

  window.fbq = fbq;
  window._fbq = fbq;

  window.fbq('init', PIXEL_ID);

  if (!document.getElementById('meta-pixel-script')) {
    const script = document.createElement('script');
    script.id = 'meta-pixel-script';
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  return true;
}

/**
 * Track a standard Meta event. Pass `eventId` when the backend sends the
 * same event through the Conversions API, so Meta counts it once.
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  if (!initPixel()) return;
  if (eventId) {
    window.fbq?.('track', eventName, params ?? {}, { eventID: eventId });
  } else if (params) {
    window.fbq?.('track', eventName, params);
  } else {
    window.fbq?.('track', eventName);
  }
}

export function trackPageView(): void {
  trackEvent('PageView');
}

export interface ViewContentInput {
  /** Paper / mock test ids, e.g. [paperId]. */
  contentIds: string[];
  /** Meta expects 'product' or 'product_group'. Defaults to 'product'. */
  contentType?: 'product' | 'product_group';
  /** Department slug, e.g. 'civil'. */
  contentCategory?: string;
  /** Human-readable name, e.g. 'CCTS Mock Test 1'. */
  contentName?: string;
}

/** Call once when a paper or mock test is opened. */
export function trackViewContent({
  contentIds,
  contentType = 'product',
  contentCategory,
  contentName,
}: ViewContentInput): void {
  trackEvent('ViewContent', {
    content_ids: contentIds,
    content_type: contentType,
    ...(contentCategory ? { content_category: contentCategory } : {}),
    ...(contentName ? { content_name: contentName } : {}),
  });
}

// ── Registration dedupe ──────────────────────────────────────────────────

/**
 * Shared event id for CompleteRegistration. The backend builds the same id
 * from the same Supabase user id, so the browser and server copies dedupe.
 */
export function registrationEventId(supabaseId: string): string {
  return `reg-${supabaseId}`;
}

/** Browser copy of CompleteRegistration for a new account. */
export function trackCompleteRegistration(supabaseId: string): void {
  trackEvent('CompleteRegistration', {}, registrationEventId(supabaseId));
}

/**
 * The Google OAuth callback runs on the server and redirects, so it can't
 * call the Pixel. On a new account it sets the short-lived `rj_reg` cookie
 * (value: the registration event id); this fires the browser copy and
 * deletes the cookie.
 */
export function firePendingRegistration(): void {
  const eventId = readCookie(PENDING_REGISTRATION_COOKIE);
  if (!eventId) return;
  deleteCookie(PENDING_REGISTRATION_COOKIE);
  trackEvent('CompleteRegistration', {}, decodeURIComponent(eventId));
}

// ── Attribution ──────────────────────────────────────────────────────────

function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_VALUE_LENGTH) : undefined;
}

/** Parse the `rj_attr` cookie value. Works on the server and in the browser. */
export function parseAttributionCookie(raw: string | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return parsed && typeof parsed === 'object' ? (parsed as Attribution) : null;
  } catch {
    return null;
  }
}

/**
 * Store UTM parameters and the Meta click id on landing. Call on every page
 * view; it only writes when there is something new.
 *
 * - UTMs are first-touch: kept from the first ad landing, not overwritten.
 * - A new `fbclid` refreshes `fbclid` and `fbc`, because Meta matches on the
 *   most recent click.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const existing = parseAttributionCookie(readCookie(ATTRIBUTION_COOKIE));
  const fbclid = clean(params.get('fbclid'));

  const utms: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const value = clean(params.get(key));
    if (value) utms[key] = value;
  }
  const hasUtms = Object.keys(utms).length > 0;

  if (existing && (!fbclid || fbclid === existing.fbclid)) return;
  if (!existing && !hasUtms && !fbclid) return;

  const next: Attribution = existing
    ? { ...existing }
    : {
        ...utms,
        landingPage: clean(window.location.pathname + window.location.search),
        firstSeenAt: new Date().toISOString(),
      };

  if (fbclid) {
    next.fbclid = fbclid;
    next.fbc = `fb.1.${Date.now()}.${fbclid}`;
  }

  writeCookie(ATTRIBUTION_COOKIE, encodeURIComponent(JSON.stringify(next)), ATTRIBUTION_MAX_AGE);
}

/** Meta's own browser cookies, read fresh (the Pixel may set them late). */
export function getMetaBrowserIds(): { fbp?: string; fbc?: string } {
  const stored = parseAttributionCookie(readCookie(ATTRIBUTION_COOKIE));
  return {
    fbp: clean(readCookie('_fbp')),
    fbc: clean(readCookie('_fbc')) ?? stored?.fbc,
  };
}

/**
 * Attribution to send with the signup call: stored UTMs and click id, plus
 * the live `_fbp` / `_fbc` cookies. Returns null when there is nothing.
 */
export function getAttribution(): Attribution | null {
  const stored = parseAttributionCookie(readCookie(ATTRIBUTION_COOKIE));
  const { fbp, fbc } = getMetaBrowserIds();
  const merged: Attribution = { ...stored, ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) };
  return Object.keys(merged).length > 0 ? merged : null;
}
