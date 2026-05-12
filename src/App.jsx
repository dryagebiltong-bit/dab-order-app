import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Paste your logo image URL here, or leave empty for text logo ──────────────
const LOGO_URL = '';
// ─────────────────────────────────────────────────────────────────────────────

const SHOP_NAME = 'Dry Age Biltong';
const B      = '#0a0a0a';
const W      = '#ffffff';
const G      = '#f8f8f8';
const BORDER = `2px solid ${B}`;
const FONT   = '"DM Sans", sans-serif';

const COLS = [
  { id: 'received',  label: 'Order Received',  short: 'NEW',   bg: B,         fg: W },
  { id: 'preparing', label: 'Preparing',        short: 'PREP',  bg: '#1a3a5c', fg: W },
  { id: 'ready',     label: 'Ready for Pickup', short: 'READY', bg: '#1a4a1a', fg: W },
  { id: 'picked_up', label: 'Picked Up',        short: 'DONE',  bg: '#666',    fg: W },
];

const SMS = {
  received: (name, pickup) =>
    `Hi ${name}, thanks for your order at ${SHOP_NAME}! We have it and will have everything ready for pickup on ${pickup}. We'll text you when it's ready.`,
  ready: (name) =>
    `Hi ${name}, your order at ${SHOP_NAME} is ready for pickup! See you soon.`,
};

const inp = {
  display: 'block', width: '100%', height: 48, border: BORDER,
  background: W, color: B, fontFamily: FONT, fontSize: '0.95rem',
  fontWeight: 600, padding: '0 0.85rem', boxSizing: 'border-box',
  outline: 'none', borderRadius: 0, appearance: 'none', WebkitAppearance: 'none',
};

const lbl = {
  display: 'block', fontSize: '0.68rem', fontWeight: 800,
  letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '0.4rem', color: B,
};

const btnBlack = {
  display: 'block', width: '100%', height: 54, background: B, color: W,
  border: BORDER, fontFamily: FONT, fontSize: '0.82rem', fontWeight: 900,
  letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 0,
};

function Logo({ dark = false }) {
  const color = dark ? '#aaa' : B;
  const line  = dark ? '#444' : B;
  if (LOGO_URL) {
    return (
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <img src={LOGO_URL} alt={SHOP_NAME}
          style={{ height: 48, width: 'auto', filter: dark ? 'invert(1)' : 'none' }} />
      </div>
    );
  }
  return (
    <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
      <div style={{ display: 'inline-block', borderBottom: `2.5px solid ${line}`, paddingBottom: '0.4rem' }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: '0.72rem', letterSpacing: '4px', textTransform: 'uppercase', color, lineHeight: 1.3 }}>Dry Age</div>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: '0.72rem', letterSpacing: '4px', textTransform: 'uppercase', color, lineHeight: 1.3 }}>Biltong</div>
      </div>
    </div>
  );
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function formatPickup(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

async function sendSMS(phone, message) {
  try {
    await fetch('/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, message }),
    });
  } catch (e) {
    console.error('SMS failed:', e);
  }
}

export default function App() {
  const [view, setView]             = useState('customer');
  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [success, setSuccess]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]         = useState({});
  const [dragOver, setDragOver]     = useState(null);
  const dragId = useRef(null);

  const [form, setForm] = useState({
    name: '', phone: '', order_text: '', pickup: '', notes: '',
  });

  useEffect(() => { loadOrders(); }, []);

  useEffect(() => {
    if (view !== 'staff') return;
    const t = setInterval(loadOrders, 20000);
    return () => clearInterval(t);
  }, [view]);

  async function loadOrders() {
    const { data } = await supabase
      .from('orders').select('*').order('created_at', { ascending: true });
    if (data) setOrders(data);
    setLoading(false);
  }

  function validate() {
    const e = {};
    if (!form.name.trim())       e.name       = true;
    if (!form.phone.trim())      e.phone      = true;
    if (!form.order_text.trim()) e.order_text = true;
    if (!form.pickup)            e.pickup     = true;
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit() {
    if (!validate() || submitting) return;
    setSubmitting(true);

    const order = {
      id: `dab_${Date.now()}`,
      name: form.name.trim(), phone: form.phone.trim(),
      order_text: form.order_text.trim(), pickup: form.pickup,
      notes: form.notes.trim(), status: 'received', created_at: Date.now(),
    };

    const { error } = await supabase.from('orders').insert(order);

    if (!error) {
      await sendSMS(order.phone, SMS.received(order.name, formatPickup(order.pickup)));
      setSuccess(true);
      setForm({ name: '', phone: '', order_text: '', pickup: '', notes: '' });
      loadOrders();
    }

    setSubmitting(false);
  }

  async function move(id, newStatus) {
    const order = orders.find(o => o.id === id);
    if (!order || order.status === newStatus) return;
    await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    if (newStatus === 'ready') {
      await sendSMS(order.phone, SMS.ready(order.name));
    }
    loadOrders();
  }

  async function del(id) {
    if (!window.confirm('Remove this order?')) return;
    await supabase.from('orders').delete().eq('id', id);
    loadOrders();
  }

  function onDragStart(e, id) { dragId.current = id; e.dataTransfer.effectAllowed = 'move'; }
  function onDragOver(e, col) { e.preventDefault(); setDragOver(col); }
  function onDrop(e, col) {
    e.preventDefault();
    if (dragId.current) move(dragId.current, col);
    dragId.current = null; setDragOver(null);
  }

  const today = new Date().toISOString().split('T')[0];

  // ── STAFF VIEW ─────────────────────────────────────────────────────────────
  if (view === 'staff') {
    return (
      <div style={{ fontFamily: FONT, background: '#111', minHeight: '100vh', color: W, padding: '1rem', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Logo dark />
            <div>
              <div style={{ fontSize: '0.58rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#555', marginBottom: 2 }}>Order Board</div>
              <div style={{ fontSize: '0.7rem', color: '#555' }}>{orders.filter(o => o.status !== 'picked_up').length} active orders</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={loadOrders} style={{ background: 'none', border: '1px solid #333', color: '#666', fontFamily: FONT, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.65rem', cursor: 'pointer' }}>Refresh</button>
            <button onClick={() => setView('customer')} style={{ background: 'none', border: '1px solid #333', color: '#666', fontFamily: FONT, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', padding: '0.35rem 0.65rem', cursor: 'pointer' }}>Order Form</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(200px, 1fr))', gap: '0.65rem', overflowX: 'auto' }}>
          {COLS.map(col => {
            const cards = orders.filter(o => o.status === col.id);
            const over  = dragOver === col.id;
            return (
              <div key={col.id}
                style={{ background: over ? '#1c1c1c' : '#161616', border: over ? '2px dashed #555' : '2px solid #222', minHeight: 420, display: 'flex', flexDirection: 'column' }}
                onDragOver={e => onDragOver(e, col.id)}
                onDrop={e => onDrop(e, col.id)}
                onDragLeave={() => setDragOver(null)}>
                <div style={{ background: col.bg, padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', color: col.fg }}>{col.label}</span>
                  <span style={{ background: 'rgba(255,255,255,0.18)', color: W, fontSize: '0.7rem', fontWeight: 900, padding: '0.1rem 0.5rem', borderRadius: 99 }}>{cards.length}</span>
                </div>
                <div style={{ padding: '0.65rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {cards.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#2a2a2a', fontSize: '0.7rem', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2.5rem' }}>Empty</div>
                  )}
                  {cards.map(o => (
                    <div key={o.id} draggable onDragStart={e => onDragStart(e, o.id)}
                      style={{ background: '#1e1e1e', border: '1px solid #2e2e2e', padding: '0.85rem', cursor: 'grab', userSelect: 'none' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#555'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#2e2e2e'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.55rem' }}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: '0.9rem', marginBottom: 2 }}>{o.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#777' }}>{o.phone}</div>
                        </div>
                        <button onClick={() => del(o.id)}
                          style={{ background: 'none', border: 'none', color: '#3a3a3a', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: 0, fontFamily: FONT }}
                          onMouseEnter={e => e.currentTarget.style.color = '#cc3333'}
                          onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}>×</button>
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: W, lineHeight: 1.5, marginBottom: '0.55rem', whiteSpace: 'pre-wrap' }}>
                        {o.order_text}
                      </div>
                      <div style={{ borderTop: '1px solid #252525', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.58rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#555', marginBottom: 2 }}>Pickup</div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#bbb' }}>{formatPickup(o.pickup)}</div>
                        </div>
                        <div style={{ fontSize: '0.58rem', color: '#444', textAlign: 'right' }}>{formatTime(o.created_at)}</div>
                      </div>
                      {o.notes && (
                        <div style={{ fontSize: '0.72rem', color: '#666', fontStyle: 'italic', borderTop: '1px solid #252525', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                          {o.notes}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
                        {COLS.filter(c => c.id !== col.id).map(c => (
                          <button key={c.id} onClick={() => move(o.id, c.id)}
                            style={{ flex: 1, background: 'none', border: '1px solid #2e2e2e', color: '#555', fontFamily: FONT, fontSize: '0.55rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.28rem 0.2rem', cursor: 'pointer', minWidth: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#ccc'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#555'; }}>
                            {c.short}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── SUCCESS ────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ fontFamily: FONT, background: G, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 440, width: '100%' }}>
          <Logo />
          <div style={{ background: W, border: BORDER, padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, background: B, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: W, fontSize: '1.4rem', fontWeight: 900 }}>✓</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Order Placed</div>
            <p style={{ fontSize: '0.88rem', color: '#666', marginBottom: '2rem', lineHeight: 1.6 }}>
              We've received your order and sent you a confirmation text. We'll SMS you again when it's ready for pickup.
            </p>
            <button style={btnBlack} onClick={() => setSuccess(false)}>Place Another Order</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <span onClick={() => setView('staff')} style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#ccc', cursor: 'pointer' }}>
              Staff View
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── CUSTOMER FORM ──────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: FONT, background: G, minHeight: '100vh', padding: '2rem 1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <Logo />
        <div style={{ background: W, border: BORDER, padding: '2rem' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.3px', marginBottom: '0.2rem' }}>Place an Order</div>
          <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: '1.75rem' }}>Fresh pickup orders — Perth store only.</div>

          <div style={{ marginBottom: '1.1rem' }}>
            <label style={lbl}>Your Name</label>
            <input style={{ ...inp, borderColor: errors.name ? '#cc0000' : B }}
              value={form.name} placeholder="Full name"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={lbl}>Phone / WhatsApp</label>
            <input style={{ ...inp, borderColor: errors.phone ? '#cc0000' : B }}
              value={form.phone} placeholder="04XX XXX XXX" type="tel"
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <div style={{ fontSize: '0.68rem', color: '#aaa', marginTop: '0.3rem' }}>We'll text you when your order is ready.</div>
          </div>

          <div style={{ borderTop: '1px solid #eee', margin: '1.5rem 0' }} />

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={lbl}>What would you like?</label>
            <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '0.5rem' }}>Make sure to include quantity in kg.</div>
            <textarea
              style={{ ...inp, height: 'auto', minHeight: 100, padding: '0.75rem 0.85rem', resize: 'vertical', borderColor: errors.order_text ? '#cc0000' : B }}
              value={form.order_text}
              placeholder="e.g. 2kg boerewors, 1kg biltong (sliced thin), 0.5kg droëwors"
              onChange={e => setForm(f => ({ ...f, order_text: e.target.value }))} />
            {errors.order_text && <div style={{ fontSize: '0.72rem', color: '#cc0000', marginTop: '0.35rem', fontWeight: 700 }}>Please tell us what you'd like to order.</div>}
          </div>

          <div style={{ borderTop: '1px solid #eee', margin: '1.5rem 0' }} />

          <div style={{ marginBottom: '1.1rem' }}>
            <label style={lbl}>Pickup Date</label>
            <input type="date" style={{ ...inp, borderColor: errors.pickup ? '#cc0000' : B }}
              value={form.pickup} min={today}
              onChange={e => setForm(f => ({ ...f, pickup: e.target.value }))} />
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <label style={lbl}>Notes (optional)</label>
            <textarea style={{ ...inp, height: 'auto', minHeight: 80, padding: '0.75rem 0.85rem', resize: 'vertical' }}
              value={form.notes} placeholder="Any special requests or cut preferences..."
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {Object.keys(errors).filter(k => k !== 'order_text').length > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#cc0000', fontWeight: 700, marginBottom: '1rem' }}>
              Please fill in all required fields.
            </div>
          )}

          <button style={{ ...btnBlack, opacity: submitting ? 0.6 : 1 }} onClick={submit} disabled={submitting}>
            {submitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.75rem' }}>
          <span onClick={() => setView('staff')}
            style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#ccc', cursor: 'pointer', userSelect: 'none' }}>
            Staff View
          </span>
        </div>
      </div>
    </div>
  );
}
