/**
 * What this app tells a browser it is allowed to do.
 *
 * The API has been behind `helmet()` since S0. The app a person actually loads had nothing — no
 * `Content-Security-Policy`, no `frame-ancestors`, no `Referrer-Policy`, no `Permissions-Policy`
 * (`.docs/Security/05-review-2026-08-05.md`, finding 1).
 *
 * **The risk that made this a high finding is clickjacking**, and it is specific rather than
 * theoretical: the school portal does consequential things in one click. Approve a member into a
 * school. Withdraw a notice from every family. Remove somebody's post from the moderation queue.
 * A principal, signed in, on a page that frames the portal invisibly under something worth
 * clicking, is the whole attack. `frame-ancestors 'none'` ends it.
 *
 * The script policy is the other half, and it is defence-in-depth rather than a fix for anything
 * known: React escapes what it renders and this codebase has no `dangerouslySetInnerHTML` at all.
 * The policy exists so that if that ever stops being true, an injected `<script>` still does not
 * run.
 *
 * **Why a nonce rather than `'unsafe-inline'`.** Next streams the RSC payload through inline
 * `<script>` tags, so a policy has to permit inline script somehow. `'unsafe-inline'` permits
 * *every* inline script, including an injected one, which leaves a script policy that reads
 * strictly and defends nothing. A per-response nonce permits exactly the tags Next emitted:
 * `next/dist/server/app-render` reads the nonce out of the request's own CSP header and stamps it
 * on them, and `'strict-dynamic'` extends that trust to the chunks those scripts load.
 *
 * The cost is real and worth stating: a nonce differs per response, so a page whose HTML was built
 * once at build time cannot carry the right one. Prerendered routes therefore opt into per-request
 * rendering — see the comment on the landing page.
 */

/** How many random bytes back each nonce. 128 bits; the value is used once and thrown away. */
const NONCE_BYTES = 16;

/**
 * A fresh nonce.
 *
 * Web Crypto rather than `node:crypto` because middleware runs on the edge runtime, where the node
 * module does not exist.
 */
export function createNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary);
}

export interface CspOptions {
  /** The value stamped on this response's script tags. */
  nonce: string;
  /** Origins the browser may open a connection to besides this one — in practice, the socket. */
  connectOrigins?: string[];
  /** Where signed media is served from. */
  imageOrigins?: string[];
  /** Development loosens exactly two things, and says which. */
  development?: boolean;
}

/**
 * The policy, as a header value.
 *
 * Every directive here is either something the app demonstrably needs or `'none'`. There is no
 * wildcard host and no `'unsafe-inline'` on scripts.
 */
export function contentSecurityPolicy({
  nonce,
  connectOrigins = [],
  imageOrigins = [],
  development = false,
}: CspOptions): string {
  const directives: Record<string, string[]> = {
    // Everything not named below — media, workers, manifests — comes from this origin or nowhere.
    'default-src': ["'self'"],

    // `'self'` is a fallback for browsers too old to understand `'strict-dynamic'`, which ignore
    // it; in every current browser the nonce is what decides.
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // React Refresh compiles components in the browser. Never sent in production.
      ...(development ? ["'unsafe-eval'"] : []),
    ],

    // Style is the exception, and deliberately so. This app styles with the `style` prop
    // throughout, which React renders as a `style="…"` attribute during SSR, and no nonce can
    // apply to an attribute. An injected style attribute is a defacement, not code execution.
    'style-src': ["'self'", "'unsafe-inline'"],

    // `data:` is the two-factor QR code, drawn in the browser. `blob:` is an upload preview.
    // Signed media lives on the object store, whose origin this app is told rather than knows.
    'img-src': ["'self'", 'data:', 'blob:', ...imageOrigins],

    'font-src': ["'self'", 'data:'],

    // The browser calls this app's own route handlers, never the API directly — except for the
    // realtime socket, which connects to the API's origin with a single-use ticket.
    'connect-src': [
      "'self'",
      ...connectOrigins,
      // The dev server's hot-reload socket.
      ...(development ? ['ws:'] : []),
    ],

    // Nothing here embeds anything, and nothing may embed this. The second is the finding.
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],

    // No plugins, no `<base>` rewriting where a relative script resolves to, and a form may only
    // post back here — which is what stops an injected form from posting a password elsewhere.
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');
}

/**
 * The headers that do **not** vary per response — `Referrer-Policy`, `Permissions-Policy` and the
 * rest — live in `next.config.mjs`, not here. They are sent from there so that they reach
 * responses middleware never runs for, static assets among them, and they are written down once
 * rather than in both places.
 */

/**
 * The socket's origin, derived from the API base this process is configured with.
 *
 * `connect-src` needs an origin, not a URL: `http://api.example/api/v1` becomes
 * `ws://api.example`, and both forms are allowed because the ticket response decides which is
 * used.
 */
export function apiConnectOrigins(apiUrl: string | undefined): string[] {
  if (!apiUrl) return [];

  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    // A malformed value must not take the site down with a broken header; the socket is
    // best-effort and degrades to "updates when you navigate".
    return [];
  }

  const secure = parsed.protocol === 'https:';
  return [parsed.origin, `${secure ? 'wss:' : 'ws:'}//${parsed.host}`];
}

/**
 * Where images may come from.
 *
 * `CSP_IMG_ORIGINS` is a space-separated list, and setting it is the right thing to do. The
 * fallback is `https:` — any origin, over TLS — because the alternative is worse: this app is told
 * the object store's address only inside the signed URLs it renders, so an unset variable would
 * otherwise mean a feed of broken images in every environment nobody remembered to configure. An
 * image is not a script; the loss is that a hypothetical injection could beacon out to a host of
 * its choosing, which `connect-src` still refuses to let it read a reply from.
 */
export function imageOriginsFromEnv(value: string | undefined, development: boolean): string[] {
  const configured = (value ?? '').split(/\s+/).filter(Boolean);
  if (configured.length > 0) return configured;

  // MinIO runs on plain http locally.
  return development ? ['https:', 'http:'] : ['https:'];
}
