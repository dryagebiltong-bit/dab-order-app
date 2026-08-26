import { readCookie, validToken } from './_session.js';

/*
 * A request is staff if it carries either:
 *   - a valid session cookie (the /staff board after signing in), or
 *   - the correct x-staff-pin header (kept so nothing breaks mid-deploy).
 */
export function authorized(req) {
  const pin = req.headers['x-staff-pin'];
  if (pin && process.env.STAFF_PIN && pin === process.env.STAFF_PIN) return true;
  return validToken(readCookie(req));
}
