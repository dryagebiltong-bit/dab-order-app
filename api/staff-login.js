/*
 * Staff sign-in.  GET = am I still signed in?   POST = sign in   DELETE = sign out
 *
 * Deliberately named staff-login.js, NOT session.js: a file called session.js
 * sitting next to the _session.js helper is too easy to mix up when uploading,
 * and the two are not interchangeable. This one is the endpoint. It is also
 * fully self-contained — the rate limiting lives here rather than in another
 * new file, so there is nothing else to remember to upload.
 */
import { supabase } from './_db.js';
import { authorized } from './_auth.js';
import { makeToken, setSessionCookie, clearSessionCookie, MAX_AGE } from './_session.js';

const MAX_FAILS  = 5;                   // wrong PINs before a lockout
const WINDOW_MS  = 15 * 60 * 1000;      // failures older than this are forgiven
const LOCKOUT_MS = 10 * 60 * 1000;      // how long a lockout lasts

const mins = ms => Math.max(1, Math.ceil(ms / 60000));

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length)      return String(fwd[0]).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/*
 * Rate limiting is backed by Supabase rather than an in-memory counter, because
 * Vercel runs several function instances and cold-starts them — an in-memory
 * count would reset and quietly hand out extra attempts.
 *
 * Every failure path below returns "allowed". If the pin_attempts table doesn't
 * exist yet, or Supabase is unreachable, sign-in carries on exactly as before.
 * A broken rate limiter must never lock staff out of their own order board.
 */
async function checkLock(ip) {
  try {
    const { data, error } = await supabase
      .from('pin_attempts').select('*').eq('ip', ip).maybeSingle();
    if (error || !data) return { locked: false };
    const now = Date.now();
    if (data.locked_until && data.locked_until > now) {
      return { locked: true, retryAfterMs: data.locked_until - now };
    }
    return { locked: false };
  } catch {
    return { locked: false };
  }
}

async function recordFailure(ip) {
  try {
    const now = Date.now();
    const { data, error } = await supabase
      .from('pin_attempts').select('*').eq('ip', ip).maybeSingle();
    if (error) return { locked: false, remaining: null };

    // Failures decay, so occasional typos on separate visits never build up.
    const stale = !data?.last_fail_at || (now - data.last_fail_at) > WINDOW_MS;
    const fails = (stale ? 0 : (data.fails || 0)) + 1;
    const locked = fails >= MAX_FAILS;

    const { error: writeErr } = await supabase.from('pin_attempts').upsert({
      ip,
      fails:        locked ? 0 : fails,
      last_fail_at: now,
      locked_until: locked ? now + LOCKOUT_MS : null,
    });
    if (writeErr) return { locked: false, remaining: null };

    return locked
      ? { locked: true,  retryAfterMs: LOCKOUT_MS }
      : { locked: false, remaining: MAX_FAILS - fails };
  } catch {
    return { locked: false, remaining: null };
  }
}

async function clearFailures(ip) {
  try { await supabase.from('pin_attempts').delete().eq('ip', ip); } catch { /* ignore */ }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const ok = authorized(req);
    return res.status(ok ? 200 : 401).json({ signedIn: ok });
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ signedIn: false });
  }

  if (req.method === 'POST') {
    const ip = clientIp(req);

    // Check the lockout before looking at the PIN, so a lockout can't be used
    // to work out whether a guess was correct.
    const lock = await checkLock(ip);
    if (lock.locked) {
      res.setHeader('Retry-After', Math.ceil(lock.retryAfterMs / 1000));
      return res.status(429).json({
        error: `Too many incorrect attempts. Try again in ${mins(lock.retryAfterMs)} minute${mins(lock.retryAfterMs) === 1 ? '' : 's'}.`,
        lockedForMs: lock.retryAfterMs,
      });
    }

    const { pin } = req.body || {};
    const correct = pin && process.env.STAFF_PIN && String(pin) === String(process.env.STAFF_PIN);

    if (!correct) {
      const result = await recordFailure(ip);
      if (result.locked) {
        res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));
        return res.status(429).json({
          error: `Too many incorrect attempts. Try again in ${mins(result.retryAfterMs)} minutes.`,
          lockedForMs: result.retryAfterMs,
        });
      }
      return res.status(401).json({
        error: 'Incorrect PIN. Try again.',
        remaining: result.remaining,
        maxAttempts: MAX_FAILS,
      });
    }

    await clearFailures(ip);
    setSessionCookie(res, makeToken());
    return res.status(200).json({ signedIn: true, days: Math.round(MAX_AGE / 86400) });
  }

  return res.status(405).end();
}
