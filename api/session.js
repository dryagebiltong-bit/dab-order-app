import crypto from 'node:crypto';

export const COOKIE  = 'dab_session';
export const MAX_AGE = 60 * 60 * 24 * 30;        // 30 days, in seconds

/*
 * The key that signs session tokens.
 *
 * STAFF_PIN is deliberately part of the key: changing the PIN in Vercel
 * invalidates every existing session, which gives you a "sign out every device"
 * lever without adding any new configuration. SESSION_SECRET is optional — if
 * it isn't set we fall back to the Supabase service key, which is already a
 * strong server-only secret, so this works with zero new env vars.
 */
function signingKey() {
  const base = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return `${base}:${process.env.STAFF_PIN || ''}`;
}

const hmac = payload => crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');

/** A signed, self-expiring token. No PIN is stored inside it. */
export function makeToken(ttlSeconds = MAX_AGE) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlSeconds * 1000 })).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

export function validToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;

  // Constant-time compare so the signature can't be guessed byte by byte.
  const a = Buffer.from(sig);
  const b = Buffer.from(hmac(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && Date.now() < exp;
  } catch {
    return false;
  }
}

export function readCookie(req, name = COOKIE) {
  const raw = req.headers?.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/*
 * SameSite=Lax is what keeps this to the direct /staff URL. When the app is
 * embedded in an iframe on dryagebiltong.com.au the browser treats calls to
 * this API as cross-site and won't send the cookie, so the website copy keeps
 * asking for the PIN every time — which is what we want on a public page.
 * HttpOnly means JavaScript can never read the token.
 */
export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`);
}
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
}
