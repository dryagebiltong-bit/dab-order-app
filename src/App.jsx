import { useState, useEffect, useRef } from 'react';

const LOGO_URL = 'https://dryagebiltong.com.au/wp-content/uploads/2026/05/download.png';
const FONT = '"DM Sans", sans-serif';
const MONO = '"SF Mono", "Fira Code", monospace';

const BG       = '#111827';
const SURFACE  = '#1f2937';
const SURFACE2 = '#2d3748';
const BORDER   = '#374151';
const T1       = '#f9fafb';
const T2       = '#9ca3af';
const T3       = '#4b5563';
const AMBER    = '#f59e0b';
const BLUE     = '#38bdf8';
const GREEN    = '#34d399';
const VIOLET   = '#a78bfa';
const RED      = '#ef4444';
const RED_DEEP = '#dc2626';

/* ── Trading hours ──────────────────────────────────────────────────────────
   9am–9pm daily, Saturdays from 7am. Change these two numbers to change every
   time dropdown in the app.                                                  */
const OPEN_HOUR     = 9;
const OPEN_HOUR_SAT = 7;
const CLOSE_HOUR    = 21;

/* ── Columns ─────────────────────────────────────────────────────────────── */
const dim = (hex, a = 0.12) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const PICKUP_COLS = [
  { id: 'received',  label: 'New Order',        color: RED,   dim: dim(RED) },
  { id: 'preparing', label: 'Preparing',        color: AMBER, dim: dim(AMBER) },
  { id: 'ready',     label: 'Ready for Pickup', color: GREEN, dim: dim(GREEN) },
];
const WEB_COLS = [
  { id: 'del_received',  label: 'New Order', color: RED,   dim: dim(RED) },
  { id: 'del_preparing', label: 'Packing',   color: AMBER, dim: dim(AMBER) },
];
const HD_COLS = [
  { id: 'hd_received',  label: 'New Order',        color: RED,   dim: dim(RED) },
  { id: 'hd_preparing', label: 'Preparing',        color: AMBER, dim: dim(AMBER) },
  { id: 'hd_out',       label: 'Out for Delivery', color: GREEN, dim: dim(GREEN) },
];
const STAGE_COLS = [
  { id: 'new',  label: 'New Orders',   color: RED,   dim: dim(RED) },
  { id: 'prep', label: 'Preparing',    color: AMBER, dim: dim(AMBER) },
  { id: 'out',  label: 'Ready / Out',  color: GREEN, dim: dim(GREEN) },
];

const WEB_STATUSES    = new Set(['del_received', 'del_preparing']);
const HD_STATUSES     = new Set(['hd_received', 'hd_preparing', 'hd_out']);
const ARCHIVE_STATUSES = new Set(['picked_up', 'shipped', 'del_shipped', 'hd_delivered']);

const SECTIONS = [
  { id: 'pickup',  label: 'Pickup',  icon: '🛍', color: AMBER,  cols: PICKUP_COLS, archiveId: 'picked_up',    archiveLabel: 'Picked Up ✓', archiveHint: 'Drag here\nwhen collected' },
  { id: 'website', label: 'Website', icon: '🌐', color: VIOLET, cols: WEB_COLS,    archiveId: 'shipped',      archiveLabel: 'Shipped 📮',  archiveHint: 'Drag here\nto ship order' },
  { id: 'deliver', label: 'Deliver', icon: '🚚', color: BLUE,   cols: HD_COLS,     archiveId: 'hd_delivered', archiveLabel: 'Delivered ✓', archiveHint: 'Drag here\nwhen delivered' },
  { id: 'all',     label: 'All',     icon: '⊞',  color: GREEN,  cols: STAGE_COLS,  archiveId: 'done',         archiveLabel: 'Done ✓',      archiveHint: 'Drag here\nwhen complete', stages: true },
  { id: 'archive', label: 'Archive', icon: '🗄', color: T3,     archiveView: true },
];

const TYPE_META = {
  pickup:  { label: 'Pickup',  icon: '🛍', color: AMBER,  whenLabel: 'Pickup' },
  website: { label: 'Website', icon: '🌐', color: VIOLET, whenLabel: 'Ordered' },
  deliver: { label: 'Deliver', icon: '🚚', color: BLUE,   whenLabel: 'Delivery' },
};

/* Which section an order lives in. Decided by status, never by order_type,
   so orders created before order_type existed still classify correctly. */
function sectionOf(o) {
  const s = o.status;
  if (WEB_STATUSES.has(s) || s === 'shipped' || s === 'del_shipped') return 'website';
  if (HD_STATUSES.has(s)  || s === 'hd_delivered')                   return 'deliver';
  return 'pickup';
}

const NEXT_STATUS = {
  received: 'preparing', preparing: 'ready', ready: null,
  del_received: 'del_preparing', del_preparing: null,
  hd_received: 'hd_preparing', hd_preparing: 'hd_out', hd_out: null,
};
const ARCHIVE_FOR = { pickup: 'picked_up', website: 'shipped', deliver: 'hd_delivered' };
const STAGE_OF = {
  received: 'new', del_received: 'new', hd_received: 'new',
  preparing: 'prep', del_preparing: 'prep', hd_preparing: 'prep',
  ready: 'out', hd_out: 'out',
};
/* In the All board, dropping a card on a stage column maps to that order's own
   status. Website has no "ready/out" stage, so that drop is ignored. */
const STATUS_FOR_STAGE = {
  pickup:  { new: 'received',     prep: 'preparing',     out: 'ready' },
  website: { new: 'del_received', prep: 'del_preparing', out: null },
  deliver: { new: 'hd_received',  prep: 'hd_preparing',  out: 'hd_out' },
};
const COL_LOOKUP = {};
[...PICKUP_COLS, ...WEB_COLS, ...HD_COLS].forEach(c => { COL_LOOKUP[c.id] = c; });

/* ── Dates & times ───────────────────────────────────────────────────────── */
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const mondayOf = d => { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); };

const todayISO    = () => isoOf(new Date());
const tomorrowISO = () => isoOf(addDays(new Date(), 1));

function timeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function formatPickup(d) {
  if (!d) return '';
  const x = parseISO(d);
  return x.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}
function formatLongDate(d) {
  if (!d) return '';
  return parseISO(d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}
function formatTime(t) {
  if (!t) return '';
  if (t === 'anytime') return 'Anytime';
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const ap = h < 12 ? 'am' : 'pm';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return hh + (m ? ':' + pad(m) : '') + ap;
}
function formatStamp(ts) {
  return new Date(ts).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
/* Half-hour slots across trading hours for the given date. */
function slotsFor(dateISO) {
  const d = dateISO ? parseISO(dateISO) : new Date();
  const from = d.getDay() === 6 ? OPEN_HOUR_SAT : OPEN_HOUR;
  const out = [];
  for (let h = from; h < CLOSE_HOUR; h++) { out.push(`${pad(h)}:00`); out.push(`${pad(h)}:30`); }
  return out;
}
/* The date an order sits on in the calendar. Website orders have no pickup
   date, so they sit on the day they came in. */
function calendarDateOf(o) {
  if (sectionOf(o) === 'website') return isoOf(new Date(o.created_at));
  return o.pickup || isoOf(new Date(o.created_at));
}

/* The staff board lives at its own URL. vercel.json already sends every
   non-/api path to index.html, so /staff needs no extra config. */
const STAFF_ROUTE = typeof window !== 'undefined' &&
  /^\/staff\/?$/i.test(window.location.pathname);

async function callAPI(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
      // Session cookie rides along automatically; nothing is kept in JS.
      credentials: 'same-origin',
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: {} };   // offline / DNS / CORS
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  return { ok: res.ok, status: res.status, data };
}

function GlobalStyles() {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { background: ${BG}; font-family: ${FONT}; -webkit-text-size-adjust: 100%; }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
      @keyframes cardIn  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes shake   { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
      @keyframes pulseRing { 0%,100% { box-shadow: 0 0 0 1.5px ${RED_DEEP}; } 50% { box-shadow: 0 0 0 4px rgba(220,38,38,0.25); } }
      .sheet  { animation: slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both; }
      .fade   { animation: fadeIn  0.2s ease both; }
      .card   { animation: cardIn  0.18s ease both; }
      .shake  { animation: shake   0.35s ease both; }
      .overdue-ring { animation: pulseRing 2s ease-in-out infinite; }
      .btn-tap { -webkit-tap-highlight-color: transparent; transition: opacity 0.12s, transform 0.1s; }
      .btn-tap:active { opacity: 0.75; transform: scale(0.97); }
      .tabscroll::-webkit-scrollbar { display: none; }
      select.dab { appearance: none; -webkit-appearance: none;
        background-image: linear-gradient(45deg, transparent 50%, ${T2} 50%), linear-gradient(135deg, ${T2} 50%, transparent 50%);
        background-position: calc(100% - 18px) calc(50% + 2px), calc(100% - 13px) calc(50% + 2px);
        background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; padding-right: 2.2rem; }
    `;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
  return null;
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */
function TypeBadge({ section, small }) {
  const t = TYPE_META[section];
  return (
    <span style={{
      display: 'inline-block', fontSize: small ? '0.53rem' : '0.6rem', fontWeight: 900,
      letterSpacing: '0.6px', textTransform: 'uppercase', padding: '0.1rem 0.4rem',
      borderRadius: '5px', background: dim(t.color, 0.2), color: t.color,
      border: `1px solid ${dim(t.color, 0.4)}`, whiteSpace: 'nowrap',
    }}>{t.icon} {t.label}</span>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <label style={{ display: 'block', fontSize: '0.64rem', fontWeight: 800, letterSpacing: '1.3px', textTransform: 'uppercase', color: T2, marginBottom: '0.38rem' }}>
        {label}
      </label>
      {children}
      {error && <div style={{ fontSize: '0.68rem', color: RED, fontWeight: 700, marginTop: '0.28rem' }}>{error}</div>}
      {hint && !error && <div style={{ fontSize: '0.66rem', color: T3, marginTop: '0.28rem' }}>{hint}</div>}
    </div>
  );
}

const inputStyle = (bad) => ({
  display: 'block', width: '100%', height: 46, background: BG,
  border: `1.5px solid ${bad ? RED : BORDER}`, color: T1, fontFamily: FONT,
  fontSize: '0.92rem', fontWeight: 600, padding: '0 0.85rem', borderRadius: '10px', outline: 'none',
});
const areaStyle = (bad, min = 66) => ({
  ...inputStyle(bad), height: 'auto', minHeight: min, padding: '0.65rem 0.85rem', resize: 'vertical',
});

function Sheet({ children, onClose, maxWidth = 470 }) {
  return (
    <div className="fade" style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
      <div className="sheet" style={{
        position: 'relative', background: SURFACE, borderRadius: '20px 20px 0 0',
        padding: '12px 0 0', maxHeight: '92vh', overflowY: 'auto', width: '100%',
        maxWidth, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div style={{ width: 40, height: 4, background: BORDER, borderRadius: 2 }} />
        </div>
        <div style={{ padding: '0 1.4rem calc(1.5rem + env(safe-area-inset-bottom))' }}>{children}</div>
      </div>
    </div>
  );
}

/* ── Tracking number prompt (website orders) ─────────────────────────────── */
function TrackingModal({ order, onConfirm, onCancel }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  return (
    <Sheet onClose={onCancel}>
      <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: T3, marginBottom: '0.3rem' }}>Shipping Order</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: T1, marginBottom: '0.2rem' }}>{order.name}</div>
      <div style={{ fontFamily: MONO, fontSize: '0.85rem', color: T2, marginBottom: '1.5rem' }}>{order.phone}</div>

      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${AMBER}`, borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: AMBER, marginBottom: '0.4rem' }}>
          📮 Enter AusPost Tracking Number
        </div>
        <div style={{ fontSize: '0.85rem', color: T2, lineHeight: 1.6 }}>
          The customer will receive an SMS with a link to track their parcel.
        </div>
      </div>

      <Field label="Tracking Number" error={error ? 'Please enter the tracking number before confirming.' : ''}>
        <input className={error ? 'shake' : ''} type="text" value={value} autoFocus
          onChange={e => { setValue(e.target.value.toUpperCase()); setError(false); }}
          placeholder="e.g. 33N00012345678901234"
          style={{ ...inputStyle(error), height: 58, fontFamily: MONO, fontSize: '1.05rem', fontWeight: 700, letterSpacing: '1.5px', borderColor: error ? RED : (value ? GREEN : BORDER) }} />
      </Field>

      <button className="btn-tap" onClick={() => { if (!value.trim()) { setError(true); return; } onConfirm(value.trim()); }}
        style={{ display: 'block', width: '100%', height: 62, background: GREEN, color: '#000', border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '1rem', fontWeight: 900, cursor: 'pointer', marginBottom: '0.6rem' }}>
        ✓ Confirm — Send Tracking to Customer
      </button>
      <button className="btn-tap" onClick={onCancel}
        style={{ display: 'block', width: '100%', height: 46, background: 'none', border: `1px solid ${BORDER}`, color: T3, borderRadius: '10px', fontFamily: FONT, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
        Cancel
      </button>
    </Sheet>
  );
}

/* ── Create order manually (staff) ───────────────────────────────────────── */
function AddOrderModal({ defaultType, onClose, onCreated }) {
  const [type, setType]           = useState(defaultType === 'deliver' ? 'deliver' : 'pickup');
  const [form, setForm]           = useState({
    name: '', phone: '', order_text: '', notes: '',
    date: todayISO(), time: '',
    address_line1: '', address_line2: '', city: '', postcode: '',
  });
  const [errors, setErrors]       = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed]       = useState('');

  const isDelivery = type === 'deliver';
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Staff may take a same-day order; the slot list follows the chosen date so
  // Saturday correctly offers the early-morning times.
  const slots = slotsFor(form.date);
  useEffect(() => {
    if (form.time && form.time !== 'anytime' && !slots.includes(form.time)) set('time', '');
  }, [form.date]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate() {
    const e = {};
    if (!form.name.trim())       e.name       = 'Please enter a name.';
    if (!form.phone.trim())      e.phone      = 'Please enter a phone number.';
    if (!form.order_text.trim()) e.order_text = 'Please enter what they have ordered.';
    if (!form.date)              e.date       = 'Please choose a date.';
    if (isDelivery) {
      if (!form.address_line1.trim()) e.address_line1 = 'Please enter a street address.';
      if (!form.city.trim())          e.city          = 'Required.';
    }
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit() {
    if (!validate() || submitting) return;
    setSubmitting(true); setFailed('');

    const body = {
      name: form.name.trim(), phone: form.phone.trim(),
      order_text: form.order_text.trim(), notes: form.notes.trim(),
      pickup: form.date, pickup_time: form.time,
      order_type: isDelivery ? 'hand_delivery' : 'pickup',
    };
    if (isDelivery) {
      body.address_line1 = form.address_line1.trim();
      body.address_line2 = form.address_line2.trim();
      body.city          = form.city.trim();
      body.postcode      = form.postcode.trim();
      body.state_au      = 'WA';
    }

    // The session cookie marks this as a staff request, which is what allows
    // a same-day order. Customers hitting the public form have no cookie.
    const { ok, data } = await callAPI('/api/create-order', { method: 'POST', body });
    setSubmitting(false);
    if (ok) onCreated(isDelivery ? 'deliver' : 'pickup', form.name.trim());
    else setFailed(data?.error || 'Could not save the order. Check your connection and try again.');
  }

  const typeBtn = (id, icon, label, sub) => (
    <button key={id} className="btn-tap" onClick={() => setType(id)}
      style={{
        flex: 1, height: 64, background: type === id ? dim(AMBER, 0.12) : BG,
        border: `2px solid ${type === id ? AMBER : BORDER}`, color: type === id ? AMBER : T2,
        borderRadius: '12px', cursor: 'pointer', fontFamily: FONT,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.1rem',
      }}>
      <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '0.58rem', fontWeight: 700, color: type === id ? dim(AMBER, 0.85) : T3 }}>{sub}</span>
    </button>
  );

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: T3, marginBottom: '0.3rem' }}>Staff Entry</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: T1, marginBottom: '0.3rem' }}>✏️ Create Order Manually</div>
      <div style={{ fontSize: '0.79rem', color: T2, lineHeight: 1.55, marginBottom: '1.15rem' }}>
        For orders taken over the phone or at the counter. The customer gets the normal confirmation text once you place it.
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
        {typeBtn('pickup', '🛍', 'Pickup', 'They collect')}
        {typeBtn('deliver', '🚚', 'Delivery', 'We deliver')}
      </div>

      <Field label="Customer Name" error={errors.name}>
        <input type="text" value={form.name} placeholder={isDelivery ? 'Name or business' : 'Full name'}
          onChange={e => set('name', e.target.value)} style={inputStyle(errors.name)} />
      </Field>

      <Field label="Phone Number" error={errors.phone}>
        <input type="tel" value={form.phone} placeholder="04XX XXX XXX"
          onChange={e => set('phone', e.target.value)} style={inputStyle(errors.phone)} />
      </Field>

      <Field label="Order" error={errors.order_text}>
        <textarea value={form.order_text} placeholder="e.g. 2kg boerewors, 1kg biltong (sliced thin)"
          onChange={e => set('order_text', e.target.value)} style={areaStyle(errors.order_text)} />
      </Field>

      {isDelivery && (
        <div style={{ background: dim(BLUE, 0.06), border: `1px solid ${dim(BLUE, 0.25)}`, borderLeft: `3px solid ${BLUE}`, borderRadius: '10px', padding: '0.85rem 0.9rem 0.1rem', marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '1.6px', textTransform: 'uppercase', color: BLUE, marginBottom: '0.7rem' }}>📍 Delivery Address</div>
          <Field label="Street Address" error={errors.address_line1}>
            <input type="text" value={form.address_line1} placeholder="12 Example Street"
              onChange={e => set('address_line1', e.target.value)} style={inputStyle(errors.address_line1)} />
          </Field>
          <Field label="Unit / Extra (optional)">
            <input type="text" value={form.address_line2} placeholder="Unit 3"
              onChange={e => set('address_line2', e.target.value)} style={inputStyle(false)} />
          </Field>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <div style={{ flex: 1 }}>
              <Field label="Suburb" error={errors.city}>
                <input type="text" value={form.city} placeholder="Hillarys"
                  onChange={e => set('city', e.target.value)} style={inputStyle(errors.city)} />
              </Field>
            </div>
            <div style={{ flex: '0 0 110px' }}>
              <Field label="Postcode">
                <input type="text" inputMode="numeric" maxLength={4} value={form.postcode} placeholder="6025"
                  onChange={e => set('postcode', e.target.value)} style={inputStyle(false)} />
              </Field>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <div style={{ flex: 1 }}>
          <Field label={isDelivery ? 'Delivery Date' : 'Pickup Date'} error={errors.date}>
            <input type="date" value={form.date} min={todayISO()}
              onChange={e => set('date', e.target.value)} style={inputStyle(errors.date)} />
          </Field>
        </div>
        <div style={{ flex: '0 0 145px' }}>
          <Field label="Time">
            <select className="dab" value={form.time} onChange={e => set('time', e.target.value)} style={inputStyle(false)}>
              <option value="">No time set</option>
              {isDelivery && <option value="anytime">Anytime</option>}
              {slots.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <div style={{ fontSize: '0.66rem', color: T3, marginTop: '-0.5rem', marginBottom: '0.9rem' }}>
        Times follow trading hours — 9am to 9pm, Saturdays from 7am. Staff can book same-day; the website cannot.
      </div>

      <Field label="Notes (optional)">
        <textarea value={form.notes} placeholder="Any special requests…"
          onChange={e => set('notes', e.target.value)} style={areaStyle(false, 52)} />
      </Field>

      {failed && <div style={{ fontSize: '0.75rem', color: RED, fontWeight: 700, marginBottom: '0.75rem' }}>{failed}</div>}

      <button className="btn-tap" onClick={submit} disabled={submitting}
        style={{ display: 'block', width: '100%', height: 56, background: isDelivery ? BLUE : GREEN, color: '#06130d', border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '0.93rem', fontWeight: 900, cursor: 'pointer', opacity: submitting ? 0.6 : 1, marginBottom: '0.55rem' }}>
        {submitting ? 'Adding…' : (isDelivery ? 'Add Delivery Order & Text Customer' : 'Add Pickup Order & Text Customer')}
      </button>
      <button className="btn-tap" onClick={onClose}
        style={{ display: 'block', width: '100%', height: 44, background: 'none', border: `1px solid ${BORDER}`, color: T3, borderRadius: '10px', fontFamily: FONT, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
        Cancel
      </button>
    </Sheet>
  );
}

/* ── Order detail (with reschedule) ──────────────────────────────────────── */
function OrderModal({ order, onMove, onShip, onDel, onReschedule, onClose }) {
  const section  = sectionOf(order);
  const isWeb    = section === 'website';
  const isHD     = section === 'deliver';
  const col      = COL_LOOKUP[order.status];
  const next     = NEXT_STATUS[order.status];
  const nextCol  = next ? COL_LOOKUP[next] : null;
  const when     = calendarDateOf(order);
  const overdue  = !isWeb && when < todayISO();

  const [open, setOpen]     = useState(false);
  const [date, setDate]     = useState(order.pickup || todayISO());
  const [time, setTime]     = useState(order.pickup_time || '');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  const slots = slotsFor(date);
  const firstName = String(order.name || '').split(' ')[0] || 'there';
  const preview =
    `Hi ${firstName}, your order at Dry Age Biltong has been rescheduled. ` +
    `Your new ${isHD ? 'delivery' : 'pickup'} is ${formatLongDate(date)}` +
    `${time && time !== 'anytime' ? ` at ${formatTime(time)}` : ''}. ` +
    `Sorry for any inconvenience, see you then!`;

  const fullAddress = [
    order.address_line1, order.address_line2,
    [order.city, order.state_au, order.postcode].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n');

  const block = (label, children, accent) => (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, ...(accent ? { borderLeft: `4px solid ${accent}` } : {}), borderRadius: '8px', padding: '0.8rem 0.95rem', marginBottom: '0.8rem' }}>
      <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: T3, marginBottom: '0.4rem' }}>{label}</div>
      {children}
    </div>
  );

  return (
    <Sheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ marginBottom: '0.4rem' }}><TypeBadge section={section} /></div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: T1, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{order.name}</div>
          <a href={`tel:${order.phone}`} style={{ fontSize: '1rem', fontWeight: 700, color: BLUE, textDecoration: 'none', display: 'block', marginTop: '0.3rem' }}>{order.phone}</a>
        </div>
        {col && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: col.dim, border: `1px solid ${dim(col.color, 0.4)}`, padding: '0.3rem 0.7rem', borderRadius: '20px', flexShrink: 0 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: col.color }} />
            <span style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '1.4px', textTransform: 'uppercase', color: col.color }}>{col.label}</span>
          </div>
        )}
      </div>

      {isWeb && order.woo_order_number && block('🌐 WooCommerce Order',
        <div style={{ fontFamily: MONO, fontSize: '0.95rem', fontWeight: 700, color: T1 }}>#{order.woo_order_number}</div>)}

      {block('🛍️ Order', <div style={{ fontSize: '0.95rem', fontWeight: 700, color: T1, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{order.order_text}</div>)}

      {fullAddress && block(isHD ? '🚚 Deliver To' : '📦 Ship To',
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: T1, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{fullAddress}</div>, BLUE)}

      {/* Date + reschedule. Website orders sit on their order date, which isn't
          something we schedule, so they can't be rescheduled. */}
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '0.8rem 0.95rem', marginBottom: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
          <div>
            <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: T3, marginBottom: '0.4rem' }}>
              📅 {TYPE_META[section].whenLabel}
            </div>
            <div style={{ fontSize: '1.02rem', fontWeight: 900, color: AMBER }}>
              {formatPickup(when)}
              {order.pickup_time ? ` · ${formatTime(order.pickup_time)}` : ''}
              {overdue      && <span style={{ color: '#fca5a5' }}> · Overdue</span>}
              {when === todayISO() && <span style={{ color: '#6ee7b7' }}> · Today</span>}
            </div>
          </div>
          {!isWeb && (
            <button className="btn-tap" onClick={() => setOpen(o => !o)}
              style={{ flexShrink: 0, height: 30, padding: '0 0.7rem', background: 'none', border: `1px solid ${overdue ? dim(RED_DEEP, 0.6) : BORDER}`, color: overdue ? '#fca5a5' : T2, borderRadius: '8px', fontFamily: FONT, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', cursor: 'pointer' }}>
              {overdue ? 'Reschedule' : 'Change'}
            </button>
          )}
        </div>

        {open && !isWeb && (
          <div className="fade" style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <div style={{ flex: 1 }}>
                <Field label={`New ${isHD ? 'delivery' : 'pickup'} date`}>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle(false), background: SURFACE, height: 44 }} />
                </Field>
              </div>
              <div style={{ flex: '0 0 130px' }}>
                <Field label="Time">
                  <select className="dab" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputStyle(false), background: SURFACE, height: 44 }}>
                    <option value="">No time set</option>
                    {isHD && <option value="anytime">Anytime</option>}
                    {slots.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            <label className="btn-tap" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.55rem 0.7rem', background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: '9px', marginBottom: '0.7rem', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: BLUE, cursor: 'pointer', flexShrink: 0, margin: 0 }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: T1 }}>Text the customer about this change</span>
            </label>

            <div style={{ background: dim(BLUE, 0.08), border: `1px solid ${dim(BLUE, 0.3)}`, borderLeft: `3px solid ${BLUE}`, borderRadius: '8px', padding: '0.65rem 0.75rem', marginBottom: '0.8rem', opacity: notify ? 1 : 0.35, filter: notify ? 'none' : 'grayscale(0.7)' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: BLUE, marginBottom: '0.35rem' }}>Text the customer will receive</div>
              <div style={{ fontSize: '0.78rem', color: T1, lineHeight: 1.55 }}>{preview}</div>
            </div>

            <button className="btn-tap" disabled={saving || !date}
              onClick={async () => { setSaving(true); await onReschedule(order.id, date, time, notify); setSaving(false); }}
              style={{ display: 'block', width: '100%', height: 50, background: BLUE, color: '#04212e', border: 'none', borderRadius: '10px', fontFamily: FONT, fontSize: '0.85rem', fontWeight: 900, cursor: 'pointer', opacity: saving ? 0.6 : 1, marginBottom: '0.45rem' }}>
              {saving ? 'Saving…' : (notify ? '✓ Save & Text Customer' : '✓ Save Change (no text)')}
            </button>
            <button className="btn-tap" onClick={() => setOpen(false)}
              style={{ display: 'block', width: '100%', height: 40, background: 'none', border: `1px solid ${BORDER}`, color: T3, borderRadius: '9px', fontFamily: FONT, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {order.notes && block('💬 Notes', <div style={{ fontSize: '0.88rem', color: T2, lineHeight: 1.6, fontWeight: 600 }}>{order.notes}</div>)}

      {order.tracking_number && block('📮 Tracking Number',
        <div style={{ fontFamily: MONO, fontSize: '0.95rem', fontWeight: 700, color: T1, letterSpacing: '1.5px' }}>{order.tracking_number}</div>, GREEN)}

      <div style={{ fontFamily: MONO, fontSize: '0.65rem', color: T3, marginBottom: '1.2rem' }}>Placed {formatStamp(order.created_at)}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {isWeb && !next && (
          <button className="btn-tap" onClick={() => { onClose(); onShip(order); }}
            style={{ height: 56, background: AMBER, color: '#000', border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '0.95rem', fontWeight: 900, cursor: 'pointer' }}>
            📮 Ship Order — Enter Tracking Number
          </button>
        )}
        {nextCol && (
          <button className="btn-tap" onClick={() => { onMove(order.id, next); onClose(); }}
            style={{ height: 56, background: nextCol.color, color: '#06130d', border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '0.95rem', fontWeight: 900, cursor: 'pointer' }}>
            → Mark as {nextCol.label}
          </button>
        )}
        <div style={{ display: 'flex', gap: '0.55rem' }}>
          {!(isWeb && !next) && (
            <button className="btn-tap" onClick={() => { onMove(order.id, ARCHIVE_FOR[section]); onClose(); }}
              style={{ flex: 1, height: 50, background: 'none', border: `2px solid ${dim(GREEN, 0.4)}`, color: GREEN, borderRadius: '12px', fontFamily: FONT, fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}>
              {isHD ? '✓ Delivered' : '✓ Picked Up'}
            </button>
          )}
          <button className="btn-tap" onClick={() => { if (window.confirm('Remove this order?')) { onDel(order.id); onClose(); } }}
            style={{ flex: 1, height: 50, background: 'none', border: `2px solid ${dim(RED, 0.25)}`, color: RED, borderRadius: '12px', fontFamily: FONT, fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}>
            🗑 Delete
          </button>
        </div>
        <button className="btn-tap" onClick={onClose}
          style={{ height: 44, background: 'none', border: `1px solid ${BORDER}`, color: T3, borderRadius: '10px', fontFamily: FONT, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
          Close
        </button>
      </div>
    </Sheet>
  );
}

/* ── Order card ──────────────────────────────────────────────────────────── */
function OrderCard({ order, showType, showDate = true, onClick }) {
  const section = sectionOf(order);
  const col     = COL_LOOKUP[order.status] || { color: T3, dim: dim(T3) };
  const when    = calendarDateOf(order);
  const overdue = section !== 'website' && when < todayISO();
  const place   = section === 'pickup' ? order.phone : `📍 ${order.city || 'No suburb'}`;

  return (
    <div className={`card btn-tap${overdue ? ' overdue-ring' : ''}`} onClick={onClick} style={{
      background: col.dim, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${col.color}`,
      borderRadius: '10px', cursor: 'pointer', overflow: 'hidden', padding: '0.7rem 0.75rem', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem', minWidth: 0 }}>
        {showType && <TypeBadge section={section} small />}
        <span style={{ fontFamily: MONO, fontSize: '0.62rem', fontWeight: 700, color: col.color, marginLeft: 'auto', flexShrink: 0 }}>
          {order.pickup_time ? formatTime(order.pickup_time) : timeAgo(order.created_at)}
        </span>
      </div>
      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: T1, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{order.name}</div>
      <div style={{ fontFamily: MONO, fontSize: '0.7rem', color: T2, marginTop: '0.12rem' }}>{place}</div>
      <div style={{ fontSize: '0.78rem', color: T2, lineHeight: 1.45, marginTop: '0.3rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {order.order_text}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '0.12rem 0.42rem', borderRadius: '20px', background: dim(col.color, 0.22), color: col.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
          {overdue ? 'Overdue · ' : ''}{col.label}
        </span>
        {showDate && (
          <span style={{ fontSize: '0.63rem', fontWeight: 800, color: T3, whiteSpace: 'nowrap' }}>
            {when === todayISO() ? 'Today' : formatPickup(when)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Board ───────────────────────────────────────────────────────────────── */
function KanbanBoard({ section, orders, isMobile, dragOver, handlers, onCardTap }) {
  const inSection = section.stages
    ? orders.filter(o => STAGE_OF[o.status])
    : orders.filter(o => section.cols.some(c => c.id === o.status));

  const cols = section.cols.map(col => ({
    ...col,
    items: section.stages
      ? inSection.filter(o => STAGE_OF[o.status] === col.id)
      : inSection.filter(o => o.status === col.id),
  }));

  const archivedCount = section.stages
    ? orders.filter(o => ARCHIVE_STATUSES.has(o.status)).length
    : orders.filter(o => o.status === section.archiveId).length;

  const n = cols.length + 1;

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '1rem', flex: 1, minHeight: 0 }}>
      <div style={{
        display: 'grid', gap: '0.7rem', padding: '0 1rem', alignItems: 'stretch',
        gridTemplateColumns: isMobile ? '1fr' : `repeat(${n}, minmax(240px, 1fr))`,
        minWidth: isMobile ? 'auto' : `${n * 250}px`,
      }}>
        {cols.map(col => {
          const over = dragOver === col.id;
          return (
            <div key={col.id} data-col-id={col.id}
              onDragOver={e => handlers.onDragOver(e, col.id)} onDrop={e => handlers.onDrop(e, col.id)} onDragLeave={handlers.onDragLeave}
              style={{ background: over ? SURFACE2 : col.dim, border: `1px solid ${over ? dim(col.color, 0.4) : BORDER}`, borderRadius: '12px', overflow: 'hidden', minHeight: isMobile ? 'auto' : 360, display: 'flex', flexDirection: 'column', transition: 'all 0.15s' }}>
              <div style={{ padding: '0.75rem 0.9rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: col.color, boxShadow: `0 0 8px ${dim(col.color, 0.55)}`, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, letterSpacing: '1.2px', textTransform: 'uppercase', color: col.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.label}</span>
                </div>
                {col.items.length > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: '0.72rem', fontWeight: 700, color: col.color, background: dim(col.color, 0.15), border: `1px solid ${dim(col.color, 0.35)}`, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {col.items.length}
                  </span>
                )}
              </div>
              <div style={{ padding: '0.55rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
                {col.items.length === 0 && <div style={{ textAlign: 'center', color: T3, fontSize: '0.65rem', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '1.5rem', opacity: 0.6 }}>Empty</div>}
                {col.items.map(o => (
                  <div key={o.id} draggable
                    onDragStart={e => handlers.onDragStart(e, o.id)}
                    onTouchStart={e => handlers.onTouchStart(e, o.id)}
                    onTouchMove={handlers.onTouchMove} onTouchEnd={handlers.onTouchEnd}
                    style={{ touchAction: 'none', userSelect: 'none' }}>
                    <OrderCard order={o} showType={!!section.stages} onClick={() => onCardTap(o)} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div data-col-id={section.archiveId}
          onDragOver={e => handlers.onDragOver(e, section.archiveId)} onDrop={e => handlers.onDrop(e, section.archiveId)} onDragLeave={handlers.onDragLeave}
          style={{ border: `2px dashed ${dragOver === section.archiveId ? GREEN : BORDER}`, borderRadius: '12px', minHeight: isMobile ? 90 : 360, display: 'flex', flexDirection: 'column', background: dragOver === section.archiveId ? SURFACE2 : 'transparent', transition: 'all 0.15s' }}>
          <div style={{ padding: '0.75rem 0.9rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 900, letterSpacing: '1.2px', textTransform: 'uppercase', color: dragOver === section.archiveId ? GREEN : T3 }}>{section.archiveLabel}</span>
            {archivedCount > 0 && <span style={{ fontFamily: MONO, fontSize: '0.75rem', color: T3 }}>{archivedCount}</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '1.5rem' }}>
            <span style={{ fontSize: '1.4rem' }}>{section.id === 'website' ? '📮' : '✓'}</span>
            <span style={{ fontSize: '0.65rem', color: dragOver === section.archiveId ? T2 : T3, letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
              {dragOver === section.archiveId ? 'Release to archive' : section.archiveHint}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Calendar ────────────────────────────────────────────────────────────── */
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function CalendarView({ orders, filter, setFilter, isMobile, onCardTap, onAdd }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selDay, setSelDay] = useState((new Date().getDay() + 6) % 7);

  const weekStart = addDays(mondayOf(new Date()), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayISO();

  const active = orders.filter(o => !ARCHIVE_STATUSES.has(o.status));
  const visible = filter === 'all' ? active : active.filter(o => sectionOf(o) === filter);

  // Overdue orders are pinned above the calendar whatever week you're viewing —
  // otherwise an uncollected order is stranded in a past week nobody opens.
  const overdue = visible.filter(o => sectionOf(o) !== 'website' && calendarDateOf(o) < today);

  const ordersOn = iso => visible
    .filter(o => calendarDateOf(o) === iso)
    .sort((a, b) => {
      const at = a.pickup_time && a.pickup_time !== 'anytime' ? a.pickup_time : null;
      const bt = b.pickup_time && b.pickup_time !== 'anytime' ? b.pickup_time : null;
      if (at && bt) return at < bt ? -1 : at > bt ? 1 : 0;
      if (at) return -1;           // timed orders first, earliest at the top
      if (bt) return 1;
      return a.created_at - b.created_at;
    });

  const weekTitle = () => {
    const a = days[0], b = days[6];
    const am = a.toLocaleDateString('en-AU', { month: 'short' });
    const bm = b.toLocaleDateString('en-AU', { month: 'short' });
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()} – ${b.getDate()} ${bm} ${b.getFullYear()}`
      : `${a.getDate()} ${am} – ${b.getDate()} ${bm} ${b.getFullYear()}`;
  };

  const navBtn = { width: 34, height: 34, flexShrink: 0, background: SURFACE, border: `1px solid ${BORDER}`, color: T2, borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const chip = (id, label) => (
    <button key={id} className="btn-tap" onClick={() => setFilter(id)}
      style={{ height: 30, padding: '0 0.7rem', background: filter === id ? 'rgba(249,250,251,0.1)' : 'none', border: `1px solid ${filter === id ? T2 : BORDER}`, color: filter === id ? T1 : T3, borderRadius: '20px', fontFamily: FONT, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.7px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.7rem 1rem', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <button className="btn-tap" style={navBtn} onClick={() => setWeekOffset(w => w - 1)}>‹</button>
          <button className="btn-tap" style={navBtn} onClick={() => setWeekOffset(w => w + 1)}>›</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? '0.76rem' : '0.85rem', fontWeight: 900, color: T1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{weekTitle()}</div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: T3, marginTop: 1 }}>
              {weekOffset === 0 ? 'This week' : weekOffset > 0 ? 'Upcoming' : 'Past'}
            </div>
          </div>
        </div>
        <button className="btn-tap" onClick={() => { setWeekOffset(0); setSelDay((new Date().getDay() + 6) % 7); }}
          style={{ height: 32, padding: '0 0.75rem', background: 'none', border: `1px solid ${weekOffset === 0 ? dim(AMBER, 0.5) : BORDER}`, color: weekOffset === 0 ? AMBER : T2, borderRadius: '8px', fontFamily: FONT, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Today
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', padding: '0.65rem 1rem 0.3rem', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {chip('pickup', 'Pickup')}{chip('website', 'Website')}{chip('deliver', 'Deliver')}{chip('all', 'All')}
        </div>
        <button className="btn-tap" onClick={onAdd}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: isMobile ? '100%' : 'auto', height: 44, padding: '0 1.1rem', background: AMBER, color: '#1a1200', border: 'none', borderRadius: '10px', fontFamily: FONT, fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer', marginTop: isMobile ? '0.4rem' : 0 }}>
          ➕ Create Order Manually
        </button>
      </div>

      {overdue.length > 0 && (
        <div style={{ margin: '0.6rem 1rem 0.2rem', background: dim(RED_DEEP, 0.12), border: `1px solid ${dim(RED_DEEP, 0.45)}`, borderLeft: `4px solid ${RED_DEEP}`, borderRadius: '10px', padding: '0.6rem 0.8rem', flexShrink: 0 }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 900, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#fca5a5', marginBottom: '0.5rem' }}>
            ⚠ {overdue.length} overdue — date has passed
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {overdue.map(o => (
              <div key={o.id} className="btn-tap" onClick={() => onCardTap(o)}
                style={{ background: SURFACE2, border: `1px solid ${dim(RED_DEEP, 0.4)}`, borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: T1 }}>{o.name}</span>
                <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: '#fca5a5' }}>{formatPickup(calendarDateOf(o))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isMobile ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="tabscroll" style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', padding: '0.7rem 1rem' }}>
            {days.map((d, i) => {
              const list = ordersOn(isoOf(d));
              const isToday = isoOf(d) === today;
              const sel = i === selDay;
              return (
                <div key={i} className="btn-tap" onClick={() => setSelDay(i)}
                  style={{ flex: '1 0 auto', minWidth: 44, background: sel ? T1 : SURFACE, border: `1px solid ${sel ? T1 : (isToday ? dim(AMBER, 0.5) : BORDER)}`, borderRadius: '10px', padding: '0.45rem 0.3rem 0.4rem', textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.8px', textTransform: 'uppercase', color: sel ? BG : (isToday ? AMBER : T3) }}>{DOW[i]}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 900, color: sel ? BG : (isToday ? AMBER : T1), lineHeight: 1.2, marginTop: 1 }}>{d.getDate()}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 3, height: 5 }}>
                    {list.slice(0, 3).map(o => (
                      <span key={o.id} style={{ width: 5, height: 5, borderRadius: '50%', display: 'block', background: (COL_LOOKUP[o.status] || {}).color || T3 }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '0 1rem 0.6rem' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: T1 }}>
              {days[selDay].toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: T3, marginTop: 2 }}>
              {isoOf(days[selDay]) === today ? 'Today · ' : ''}{ordersOn(isoOf(days[selDay])).length} {ordersOn(isoOf(days[selDay])).length === 1 ? 'order' : 'orders'}
            </div>
          </div>

          <div style={{ padding: '0 1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ordersOn(isoOf(days[selDay])).length === 0
              ? <div style={{ textAlign: 'center', color: T3, fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '2.5rem 1rem' }}>No orders for this day</div>
              : ordersOn(isoOf(days[selDay])).map(o => <OrderCard key={o.id} order={o} showType={filter === 'all'} showDate={false} onClick={() => onCardTap(o)} />)}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0.7rem 1rem 1rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.5rem', alignItems: 'stretch', flex: 1 }}>
            {days.map((d, i) => {
              const key = isoOf(d);
              const list = ordersOn(key);
              const isToday = key === today;
              return (
                <div key={key} style={{ background: isToday ? dim(AMBER, 0.05) : 'rgba(255,255,255,0.02)', border: `1px solid ${isToday ? dim(AMBER, 0.55) : BORDER}`, borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 190, opacity: key < today ? 0.55 : 1 }}>
                  <div style={{ padding: '0.5rem 0.55rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.58rem', fontWeight: 900, letterSpacing: '1.2px', textTransform: 'uppercase', color: isToday ? AMBER : T3 }}>{DOW[i]}</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 900, color: isToday ? AMBER : T1, lineHeight: 1.1 }}>{d.getDate()}</div>
                    </div>
                    {list.length > 0 && <span style={{ fontFamily: MONO, fontSize: '0.62rem', fontWeight: 700, color: T2, background: 'rgba(255,255,255,0.07)', borderRadius: '20px', padding: '0.1rem 0.4rem', flexShrink: 0 }}>{list.length}</span>}
                  </div>
                  <div style={{ padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                    {list.length === 0
                      ? <div style={{ textAlign: 'center', color: T3, fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0.9rem 0.2rem', opacity: 0.65 }}>—</div>
                      : list.map(o => <OrderCard key={o.id} order={o} showType={filter === 'all'} showDate={false} onClick={() => onCardTap(o)} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Archive ─────────────────────────────────────────────────────────────── */
function ArchiveList({ orders, onMove, onDel }) {
  const [search, setSearch] = useState('');
  const q = search.toLowerCase().trim();
  const list = orders
    .filter(o => ARCHIVE_STATUSES.has(o.status))
    .filter(o => !q || [o.name, o.phone, o.order_text, o.city, o.woo_order_number, o.tracking_number]
      .some(f => (f || '').toLowerCase().includes(q)))
    .sort((a, b) => b.created_at - a.created_at);

  const RESTORE_TO = { pickup: 'received', website: 'del_received', deliver: 'hd_received' };
  const DONE_LABEL = { pickup: 'Picked up', website: 'Shipped', deliver: 'Delivered' };

  return (
    <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
      <input type="text" placeholder="Search archive…" value={search} onChange={e => setSearch(e.target.value)}
        style={{ ...inputStyle(false), height: 48, background: SURFACE, marginBottom: '1rem' }} />
      {list.length === 0 && (
        <div style={{ textAlign: 'center', color: T3, marginTop: '3rem', fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {q ? 'No results' : 'No archived orders yet'}
        </div>
      )}
      {list.map(o => {
        const section = sectionOf(o);
        const t = TYPE_META[section];
        return (
          <div key={o.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${t.color}`, borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                <TypeBadge section={section} small />
                <span style={{ fontWeight: 900, fontSize: '0.95rem', color: T1 }}>{o.name}</span>
                <span style={{ fontFamily: MONO, fontSize: '0.72rem', color: T2 }}>{o.phone}</span>
                <span style={{ fontSize: '0.58rem', fontWeight: 800, color: T3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{DONE_LABEL[section]}</span>
                {o.woo_order_number && <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: T3 }}>#{o.woo_order_number}</span>}
              </div>
              <div style={{ fontSize: '0.82rem', color: T2, lineHeight: 1.5, marginBottom: '0.3rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.order_text}</div>
              {o.tracking_number && <div style={{ fontFamily: MONO, fontSize: '0.7rem', color: GREEN, fontWeight: 700, marginBottom: '0.25rem' }}>📮 {o.tracking_number}</div>}
              <div style={{ fontFamily: MONO, fontSize: '0.65rem', color: T3 }}>{formatStamp(o.created_at)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
              <button className="btn-tap" onClick={() => onMove(o.id, RESTORE_TO[section])}
                style={{ background: 'none', border: `1px solid ${BORDER}`, color: T2, fontFamily: FONT, fontSize: '0.68rem', fontWeight: 700, padding: '0.4rem 0.65rem', cursor: 'pointer', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                Restore
              </button>
              <button className="btn-tap" onClick={() => { if (window.confirm('Delete this order permanently?')) onDel(o.id); }}
                style={{ background: 'none', border: 'none', color: T3, fontSize: '1.2rem', cursor: 'pointer', textAlign: 'center', borderRadius: '6px', padding: '0.2rem' }}>×</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── App ─────────────────────────────────────────────────────────────────── */
export default function App() {
  const [authed, setAuthed]       = useState(false);
  const [checkingSession, setCheckingSession] = useState(STAFF_ROUTE);
  const [mode, setMode]           = useState('board');       // board | calendar
  const [section, setSection]     = useState('pickup');
  const [calFilter, setCalFilter] = useState('pickup');
  const [orders, setOrders]       = useState([]);
  const [selectedOrder, setSelectedOrder]       = useState(null);
  const [pendingShipOrder, setPendingShipOrder] = useState(null);
  const [showAddOrder, setShowAddOrder]         = useState(false);
  const [toast, setToast]         = useState('');
  const [success, setSuccess]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]       = useState({});
  const [formError, setFormError] = useState('');
  const [dragOver, setDragOver]   = useState(null);
  const [pinInput, setPinInput]   = useState('');
  const [pinError, setPinError]   = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [lockedFor, setLockedFor]     = useState(0);      // ms remaining on a lockout
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isMobile, setIsMobile]   = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const dragId      = useRef(null);
  const touchDragId = useRef(null);
  const toastTimer  = useRef(null);

  // Customers must book at least one day ahead.
  const minCustomerDate = tomorrowISO();
  const [form, setForm] = useState({ name: '', phone: '', order_text: '', pickup: '', pickup_time: '', notes: '' });

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // On the /staff URL, ask the server whether this device is still signed in
  // before showing anything, so a returning iPad goes straight to the board.
  useEffect(() => {
    if (!STAFF_ROUTE) return;
    let cancelled = false;
    (async () => {
      const { ok } = await callAPI('/api/staff-login', { method: 'GET' });
      if (!cancelled) { setAuthed(ok); setCheckingSession(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (authed) loadOrders(); }, [authed]); // eslint-disable-line
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(loadOrders, 20000);
    return () => clearInterval(t);
  }, [authed]); // eslint-disable-line

  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setTimeout(() => setLockedFor(v => Math.max(0, v - 1000)), 1000);
    return () => clearTimeout(t);
  }, [lockedFor]);

  function flash(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }

  async function loadOrders() {
    const { ok, data } = await callAPI('/api/get-orders', { method: 'GET' });
    if (ok) setOrders(data.orders || []);
  }
  async function handleRefresh() {
    setRefreshing(true);
    await loadOrders();
    setTimeout(() => setRefreshing(false), 600);
  }
  async function handlePinSubmit() {
    if (!pinInput.trim() || lockedFor > 0 || pinLoading) return;
    setPinLoading(true); setPinError('');
    // A correct PIN gets an HttpOnly session cookie back, good for 30 days.
    const { ok, status, data } = await callAPI('/api/staff-login', { method: 'POST', body: { pin: pinInput.trim() } });
    if (ok) {
      setAuthed(true); setPinInput(''); setLockedFor(0); setAttemptsLeft(null);
    } else if (status === 429) {
      setPinError(data?.error || 'Too many incorrect attempts. Please wait and try again.');
      if (data?.lockedForMs) { setLockedFor(data.lockedForMs); setPinInput(''); }
    } else if (status === 401) {
      setPinError(data?.error || 'Incorrect PIN. Try again.');
      setAttemptsLeft(typeof data?.remaining === 'number' ? data.remaining : null);
    } else if (status === 404) {
      setPinError('Sign-in service not found. api/staff-login.js is missing from the deployment.');
    } else if (status === 0) {
      setPinError('Cannot reach the server. Check your internet connection.');
    } else {
      setPinError(`Server error (${status}). Your PIN is probably fine — try again shortly.`);
    }
    setPinLoading(false);
  }

  /* ── customer order form ── */
  function validate() {
    const e = {};
    if (!form.name.trim())       e.name       = true;
    if (!form.phone.trim())      e.phone      = true;
    if (!form.order_text.trim()) e.order_text = true;
    if (!form.pickup)            e.pickup     = true;
    else if (form.pickup < minCustomerDate) e.pickup = true;
    setErrors(e);
    return !Object.keys(e).length;
  }
  async function submit() {
    if (!validate() || submitting) return;
    setSubmitting(true); setFormError('');
    const { ok, data } = await callAPI('/api/create-order', {
      method: 'POST',
      body: {
        name: form.name.trim(), phone: form.phone.trim(),
        order_text: form.order_text.trim(), pickup: form.pickup,
        pickup_time: form.pickup_time, notes: form.notes.trim(),
        order_type: 'pickup',
      },
    });
    if (ok) { setSuccess(true); setForm({ name: '', phone: '', order_text: '', pickup: '', pickup_time: '', notes: '' }); }
    else setFormError(data?.error || 'Something went wrong. Please try again.');
    setSubmitting(false);
  }

  /* ── staff actions ── */
  async function move(id, newStatus, trackingNumber = null) {
    const order = orders.find(o => o.id === id);
    if (!order || !newStatus || order.status === newStatus) return;
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus, ...(trackingNumber ? { tracking_number: trackingNumber } : {}) } : o));
    const body = { id, status: newStatus };
    if (trackingNumber) body.tracking_number = trackingNumber;
    const { ok } = await callAPI('/api/update-order', { method: 'POST', body });
    if (!ok) { flash('Could not save that change — reloading'); loadOrders(); }
  }

  async function reschedule(id, date, time, notify) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, pickup: date, pickup_time: time || null } : o));
    setSelectedOrder(null);
    const { ok } = await callAPI('/api/update-order', {
      method: 'POST', body: { id, pickup: date, pickup_time: time, notify: !!notify },
    });
    if (ok) flash(`Moved to ${formatPickup(date)}${time && time !== 'anytime' ? ' ' + formatTime(time) : ''}${notify ? ' — customer texted' : ' — no text sent'}`);
    else { flash('Could not save the new date — reloading'); loadOrders(); }
  }

  async function del(id) {
    setOrders(prev => prev.filter(o => o.id !== id));
    callAPI('/api/delete-order', { method: 'DELETE', body: { id } });
  }

  /* Resolve a drop target into a real status for this order. */
  function statusForDrop(order, colId) {
    const sec = sectionOf(order);
    if (colId === 'done' || colId === ARCHIVE_FOR[sec]) return ARCHIVE_FOR[sec];
    if (STAGE_COLS.some(c => c.id === colId)) return STATUS_FOR_STAGE[sec][colId];   // All board
    return COL_LOOKUP[colId] ? colId : null;
  }
  function applyDrop(id, colId) {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    const target = statusForDrop(order, colId);
    if (!target) return;                                   // e.g. website has no "ready/out"
    if (target === 'shipped' && sectionOf(order) === 'website') { setPendingShipOrder(order); return; }
    move(id, target);
  }

  const handlers = {
    onDragStart: (e, id) => { dragId.current = id; e.dataTransfer.effectAllowed = 'move'; },
    onDragOver:  (e, col) => { e.preventDefault(); setDragOver(col); },
    onDragLeave: () => setDragOver(null),
    onDrop: (e, col) => {
      e.preventDefault();
      if (dragId.current) applyDrop(dragId.current, col);
      dragId.current = null; setDragOver(null);
    },
    onTouchStart: (e, id) => { touchDragId.current = id; },
    onTouchMove: (e) => {
      if (!touchDragId.current) return;
      e.preventDefault();
      const t = e.touches[0];
      const col = document.elementFromPoint(t.clientX, t.clientY)?.closest('[data-col-id]');
      setDragOver(col ? col.getAttribute('data-col-id') : null);
    },
    onTouchEnd: (e) => {
      if (!touchDragId.current) return;
      const t = e.changedTouches[0];
      const col = document.elementFromPoint(t.clientX, t.clientY)?.closest('[data-col-id]');
      if (col) applyDrop(touchDragId.current, col.getAttribute('data-col-id'));
      touchDragId.current = null; setDragOver(null);
    },
  };

  const activeOrders = orders.filter(o => !ARCHIVE_STATUSES.has(o.status));
  const countFor = id =>
    id === 'all'     ? activeOrders.length :
    id === 'archive' ? orders.filter(o => ARCHIVE_STATUSES.has(o.status)).length :
                       activeOrders.filter(o => sectionOf(o) === id).length;

  const m = isMobile;
  const currentSection = SECTIONS.find(s => s.id === section) || SECTIONS[0];

  /* ── Session check in flight ── */
  if (STAFF_ROUTE && checkingSession) {
    return (
      <>
        <GlobalStyles />
        <div style={{ fontFamily: FONT, background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '2.5px', textTransform: 'uppercase', color: T3 }}>Loading…</div>
        </div>
      </>
    );
  }

  /* ── PIN gate ── */
  const locked   = lockedFor > 0;
  const lockMins = Math.floor(lockedFor / 60000);
  const lockSecs = String(Math.floor((lockedFor % 60000) / 1000)).padStart(2, '0');

  if (STAFF_ROUTE && !authed) {
    return (
      <>
        <GlobalStyles />
        <div style={{ fontFamily: FONT, background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
          <div style={{ width: '100%', maxWidth: 380 }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              {LOGO_URL ? <img src={LOGO_URL} alt="" style={{ height: 64, filter: 'invert(1)', width: 'auto' }} />
                        : <span style={{ fontSize: '1.2rem', fontWeight: 900, color: T1, letterSpacing: '3px', textTransform: 'uppercase' }}>DRY AGE BILTONG</span>}
            </div>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '2rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '2.5px', textTransform: 'uppercase', color: T3, textAlign: 'center', marginBottom: '1.75rem' }}>Staff Login</div>
              <Field label="PIN" error={pinError}>
                <input type="password" inputMode="numeric" maxLength={8} value={pinInput} placeholder="Enter PIN" autoFocus
                  disabled={locked}
                  onChange={e => { setPinInput(e.target.value); setPinError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                  style={{ ...inputStyle(!!pinError), height: 56, fontSize: '1.3rem', letterSpacing: '6px', opacity: locked ? 0.5 : 1 }} />
              </Field>

              {locked && (
                <div style={{ background: dim(RED, 0.1), border: `1px solid ${dim(RED, 0.35)}`, borderRadius: '10px', padding: '0.7rem 0.85rem', marginBottom: '0.85rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fca5a5', letterSpacing: '0.5px' }}>
                    🔒 Locked — try again in {lockMins}:{lockSecs}
                  </div>
                </div>
              )}

              {!locked && attemptsLeft !== null && attemptsLeft > 0 && (
                <div style={{ fontSize: '0.72rem', color: T3, fontWeight: 700, marginBottom: '0.85rem', textAlign: 'center' }}>
                  {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} left before a temporary lockout
                </div>
              )}

              <button className="btn-tap" onClick={handlePinSubmit} disabled={pinLoading || locked}
                style={{ display: 'block', width: '100%', height: 56, background: T1, color: BG, border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '0.9rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', cursor: locked ? 'not-allowed' : 'pointer', opacity: (pinLoading || locked) ? 0.45 : 1, marginTop: '0.5rem' }}>
                {locked ? 'Locked' : pinLoading ? '...' : 'Enter'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <a href="/" style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T3, cursor: 'pointer', textDecoration: 'none' }}>← Back to Order Form</a>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Staff board ── */
  if (STAFF_ROUTE && authed) {
    return (
      <>
        <GlobalStyles />
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: BG }}>

          <div style={{ position: 'sticky', top: 0, zIndex: 100, background: BG, borderBottom: `1px solid ${BORDER}`, padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexShrink: 0 }}>
            <div style={{ flexShrink: 0 }}>
              {LOGO_URL ? <img src={LOGO_URL} alt="" style={{ height: m ? 30 : 36, filter: 'invert(1)', width: 'auto' }} />
                        : <span style={{ fontSize: '0.9rem', fontWeight: 900, color: T1 }}>DAB</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <div style={{ display: 'flex', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '9px', padding: 3, gap: 3 }}>
                {[['board', '▤ Board'], ['calendar', '📅 Calendar']].map(([id, label]) => (
                  <button key={id} className="btn-tap" onClick={() => setMode(id)}
                    style={{ border: 'none', background: mode === id ? T1 : 'none', color: mode === id ? BG : T3, fontFamily: FONT, fontSize: m ? '0.58rem' : '0.64rem', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', padding: m ? '0 0.5rem' : '0 0.7rem', height: 28, borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {label}
                  </button>
                ))}
              </div>
              {!m && (
                <button className="btn-tap" onClick={handleRefresh}
                  style={{ height: 34, padding: '0 0.7rem', background: SURFACE, border: `1px solid ${BORDER}`, color: T2, fontFamily: FONT, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px' }}>
                  {refreshing ? '...' : '↻ Refresh'}
                </button>
              )}
              <button className="btn-tap" onClick={async () => { await callAPI('/api/staff-login', { method: 'DELETE' }); setAuthed(false); setOrders([]); }}
                style={{ height: 34, padding: '0 0.7rem', background: 'none', border: `1px solid ${BORDER}`, color: T3, fontFamily: FONT, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px' }}>
                Lock
              </button>
            </div>
          </div>

          {mode === 'board' && (
            <div className="tabscroll" style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, overflowX: 'auto', flexShrink: 0, background: BG }}>
              {SECTIONS.map(s => {
                const on = s.id === section;
                const c = countFor(s.id);
                return (
                  <button key={s.id} className="btn-tap" onClick={() => setSection(s.id)}
                    style={{ flex: m ? '1 0 auto' : '1 0 0', minWidth: 76, height: 56, background: 'none', border: 'none', borderBottom: `3px solid ${on ? s.color : 'transparent'}`, cursor: 'pointer', fontFamily: FONT, padding: '0 0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.08rem', transition: 'border-color 0.15s' }}>
                    <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{s.icon}</span>
                    <span style={{ fontSize: '0.63rem', fontWeight: 900, letterSpacing: '0.5px', textTransform: 'uppercase', color: on ? s.color : T3, whiteSpace: 'nowrap' }}>{s.label}</span>
                    {c > 0 && <span style={{ fontFamily: MONO, fontSize: '0.62rem', fontWeight: 700, color: on ? s.color : T3, background: on ? dim(s.color, 0.18) : 'none', padding: '0.02rem 0.4rem', borderRadius: '12px' }}>{c}</span>}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, paddingBottom: '1.5rem' }}>
            {mode === 'calendar' ? (
              <CalendarView orders={orders} filter={calFilter} setFilter={setCalFilter} isMobile={m}
                onCardTap={setSelectedOrder} onAdd={() => setShowAddOrder(true)} />
            ) : currentSection.archiveView ? (
              <ArchiveList orders={orders} onMove={move} onDel={del} />
            ) : (
              <>
                <div style={{ padding: '0.75rem 1rem 0.35rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}>
                  <button className="btn-tap" onClick={() => setShowAddOrder(true)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: m ? '100%' : 'auto', height: 46, padding: '0 1.2rem', background: AMBER, color: '#1a1200', border: 'none', borderRadius: '11px', fontFamily: FONT, fontSize: '0.8rem', fontWeight: 900, cursor: 'pointer' }}>
                    ➕ Create Order Manually
                  </button>
                  {!m && section === 'website' && (
                    <span style={{ fontSize: '0.66rem', color: T3, fontWeight: 600 }}>Website orders arrive automatically from WooCommerce</span>
                  )}
                  {!m && section === 'deliver' && (
                    <span style={{ fontSize: '0.66rem', color: T3, fontWeight: 600 }}>Hand-delivered orders are added here</span>
                  )}
                </div>
                <KanbanBoard section={currentSection} orders={orders} isMobile={m} dragOver={dragOver}
                  handlers={handlers} onCardTap={setSelectedOrder} />
              </>
            )}
          </div>
        </div>

        {selectedOrder && (
          <OrderModal
            order={orders.find(o => o.id === selectedOrder.id) || selectedOrder}
            onMove={move}
            onShip={order => { setSelectedOrder(null); setPendingShipOrder(order); }}
            onDel={del}
            onReschedule={reschedule}
            onClose={() => setSelectedOrder(null)} />
        )}

        {pendingShipOrder && (
          <TrackingModal
            order={pendingShipOrder}
            onConfirm={tracking => { move(pendingShipOrder.id, 'shipped', tracking); setPendingShipOrder(null); }}
            onCancel={() => setPendingShipOrder(null)} />
        )}

        {showAddOrder && (
          <AddOrderModal
            defaultType={section === 'deliver' ? 'deliver' : 'pickup'}
            onClose={() => setShowAddOrder(false)}
            onCreated={(type, name) => {
              setShowAddOrder(false);
              if (mode === 'board' && section !== 'all') setSection(type);
              if (mode === 'calendar' && calFilter !== 'all') setCalFilter(type);
              loadOrders();
              flash(`Added to ${type === 'deliver' ? 'Deliver' : 'Pickup'} — confirmation text sent to ${name.split(' ')[0]}`);
            }} />
        )}

        {toast && (
          <div className="fade" style={{ position: 'fixed', left: '50%', bottom: 22, transform: 'translateX(-50%)', zIndex: 400, background: GREEN, color: '#062015', fontSize: '0.78rem', fontWeight: 800, padding: '0.65rem 1.1rem', borderRadius: '30px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxWidth: '90vw', textAlign: 'center' }}>
            {toast}
          </div>
        )}
      </>
    );
  }

  /* ── Customer: success ── */
  if (success) {
    return (
      <>
        <GlobalStyles />
        <div style={{ fontFamily: FONT, background: '#f9fafb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
          <div style={{ maxWidth: 440, width: '100%' }}>
            {LOGO_URL && <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}><img src={LOGO_URL} alt="" style={{ height: m ? 44 : 72, width: 'auto' }} /></div>}
            <div style={{ background: '#fff', border: '2px solid #111827', borderRadius: '16px', padding: m ? '1.5rem' : '2.5rem', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, background: '#111827', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.4rem' }}>✓</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#111827', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Order Placed</div>
              <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1.75rem', lineHeight: 1.7 }}>We've received your order and sent you a confirmation SMS. We'll text you when it's ready.</p>
              <button className="btn-tap" onClick={() => setSuccess(false)} style={{ display: 'block', width: '100%', height: 54, background: '#111827', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '0.9rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>
                Place Another Order
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Customer: order form ── */
  const inp = { display: 'block', width: '100%', height: m ? 48 : 52, border: '1.5px solid #d1d5db', background: '#fff', color: '#111827', fontFamily: FONT, fontSize: '1rem', fontWeight: 600, padding: '0 1rem', boxSizing: 'border-box', outline: 'none', borderRadius: '10px', appearance: 'none', WebkitAppearance: 'none' };
  const lbl = { display: 'block', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '0.45rem', color: '#374151' };
  const customerSlots = slotsFor(form.pickup || minCustomerDate);

  return (
    <>
      <GlobalStyles />
      <div style={{ fontFamily: FONT, background: '#f3f4f6', minHeight: '100vh', padding: m ? '1rem' : '2.5rem 1rem' }}>
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          {LOGO_URL && <div style={{ textAlign: 'center', marginBottom: m ? '1rem' : '2rem' }}><img src={LOGO_URL} alt="Dry Age Biltong" style={{ height: m ? 48 : 80, width: 'auto' }} /></div>}
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '16px', padding: m ? '1.25rem' : '2.25rem' }}>
            <div style={{ fontSize: m ? '1.2rem' : '1.5rem', fontWeight: 900, color: '#111827', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Place an Order</div>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: m ? '1.25rem' : '1.75rem' }}>Fresh pickup — Perth store only</div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={lbl}>Your Name</label>
              <input style={{ ...inp, borderColor: errors.name ? '#ef4444' : '#d1d5db' }} value={form.name} placeholder="Full name"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={lbl}>Phone Number</label>
              <input style={{ ...inp, borderColor: errors.phone ? '#ef4444' : '#d1d5db' }} value={form.phone} placeholder="04XX XXX XXX" type="tel"
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.3rem' }}>We'll SMS you when your order is ready.</div>
            </div>

            <div style={{ borderTop: '1px solid #f3f4f6', margin: '1.25rem 0' }} />

            <div style={{ marginBottom: '1rem' }}>
              <label style={lbl}>What would you like?</label>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.4rem' }}>Include quantity in kg</div>
              <textarea style={{ ...inp, height: 'auto', minHeight: m ? 80 : 110, padding: '0.75rem 1rem', resize: 'vertical', borderColor: errors.order_text ? '#ef4444' : '#d1d5db' }}
                value={form.order_text} placeholder="e.g. 2kg boerewors, 1kg biltong (sliced thin)"
                onChange={e => setForm(f => ({ ...f, order_text: e.target.value }))} />
              {errors.order_text && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem', fontWeight: 700 }}>Please enter your order.</div>}
            </div>

            <div style={{ borderTop: '1px solid #f3f4f6', margin: '1.25rem 0' }} />

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Pickup Date</label>
                {/* Earliest is tomorrow — same-day pickup isn't offered online.
                    The server enforces this too; `min` alone can be bypassed. */}
                <input type="date" style={{ ...inp, borderColor: errors.pickup ? '#ef4444' : '#d1d5db' }}
                  value={form.pickup} min={minCustomerDate}
                  onChange={e => setForm(f => ({ ...f, pickup: e.target.value }))} />
              </div>
              <div style={{ flex: '0 0 140px' }}>
                <label style={lbl}>Time</label>
                <select className="dab" style={{ ...inp, paddingRight: '2.2rem' }} value={form.pickup_time}
                  onChange={e => setForm(f => ({ ...f, pickup_time: e.target.value }))}>
                  <option value="">Any time</option>
                  {customerSlots.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: '1rem' }}>
              Orders need at least one day's notice. We're open 9am–9pm, Saturdays from 7am.
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={lbl}>Notes (optional)</label>
              <textarea style={{ ...inp, height: 'auto', minHeight: m ? 60 : 80, padding: '0.75rem 1rem', resize: 'vertical' }}
                value={form.notes} placeholder="Any special requests…"
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {formError && <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700, marginBottom: '0.75rem' }}>{formError}</div>}
            {!formError && Object.keys(errors).filter(k => k !== 'order_text').length > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700, marginBottom: '0.75rem' }}>
                {errors.pickup && form.pickup && form.pickup < minCustomerDate
                  ? 'Please choose tomorrow or later — we need a day’s notice.'
                  : 'Please fill in all required fields.'}
              </div>
            )}

            <button className="btn-tap" onClick={submit} disabled={submitting}
              style={{ display: 'block', width: '100%', height: m ? 52 : 56, background: '#111827', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '0.95rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Placing Order…' : 'Place Order'}
            </button>
          </div>
          <div style={{ paddingBottom: '1.5rem' }} />
        </div>
      </div>
    </>
  );
}
