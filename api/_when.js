// Shared date/time helpers.
//
// IMPORTANT: Vercel functions run in UTC. Perth is UTC+8, so "today" on the
// server can be yesterday in the shop. Everything date-related must be computed
// in Australia/Perth or the next-day pickup rule breaks for eight hours a day.

export const SHOP_TZ = 'Australia/Perth';

/** Today in Perth as YYYY-MM-DD, optionally offset by whole days. */
export function perthDateISO(offsetDays = 0) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  if (!offsetDays) return today;

  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  const p = n => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** '2026-08-26' -> 'Wednesday 26 August' */
export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/** '14:30' -> '2:30pm'. 'anytime' passes through. */
export function fmtTime(t) {
  if (!t) return '';
  if (t === 'anytime') return 'anytime';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const ap = h < 12 ? 'am' : 'pm';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return hh + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
}

/** 'Wednesday 26 August at 2:30pm' — or just the date if no usable time. */
export function fmtWhen(iso, time) {
  const d = fmtDate(iso);
  if (!time || time === 'anytime') return d;
  return `${d} at ${fmtTime(time)}`;
}
