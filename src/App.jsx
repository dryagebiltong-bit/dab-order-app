import { useState, useEffect, useRef } from 'react';

const LOGO_URL = 'https://staging4.dryagebiltong.com.au/wp-content/uploads/2026/05/download.png';

const B      = '#0a0a0a';
const W      = '#ffffff';
const G      = '#f8f8f8';
const BORDER = `2px solid ${B}`;
const FONT   = '"DM Sans", sans-serif';

const COLS = [
  { id: 'received',  label: 'Order Received',  short: 'NEW',   bg: B,         fg: W },
  { id: 'preparing', label: 'Preparing',        short: 'PREP',  bg: '#1a3a5c', fg: W },
  { id: 'ready',     label: 'Ready for Pickup', short: 'READY', bg: '#1a4a1a', fg: W },
];

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
        <img src={LOGO_URL} alt="Dry Age Biltong"
          style={{ height: 120, width: 'auto', filter: dark ? 'invert(1)' : 'none' }} />
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
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

async function callAPI(path, options = {}, pin = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (pin) headers['x-staff-pin'] = pin;
  const res = await fetch(path, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

function StaffHeader({ orders, onRefresh, onLock, archiveView, setArchiveView }) {
  const active   = orders.filter(o => o.status !== 'picked_up').length;
  const archived = orders.filter(o => o.status === 'picked_up').length;
  const headerBtn = {
    background: 'none', border: '1px solid #333', color: '#666', fontFamily: FONT,
    fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase',
    padding: '0.35rem 0.65rem', cursor: 'pointer',
  };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Logo dark />
        <div>
          <div style={{ fontSize: '0.58rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#555', marginBottom: 2 }}>
            {archiveView ? 'Picked Up Orders' : 'Order Board'}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#555' }}>
            {archiveView ? `${archived} orders` : `${active} active orders`}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => setArchiveView(v => !v)}
          style={{ ...headerBtn, borderColor: archiveView ? '#666' : '#333', color: archiveView ? '#aaa' : '#666' }}>
          {archiveView ? '← Live Board' : `Archive (${archived})`}
        </button>
        <button onClick={onRefresh} style={headerBtn}>Refresh</button>
        <button onClick={onLock} style={headerBtn}>Lock</button>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView]                   = useState('customer');
  const [orders, setOrders]               = useState([]);
  const [archiveView, setArchiveView]     = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [success, setSuccess]             = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [errors, setErrors]               = useState({});
  const [dragOver, setDragOver]           = useState(null);
  const [pin, setPin]                     = useState('');
  const [pinInput, setPinInput]           = useState('');
  const [pinError, setPinError]           = useState('');
  const [pinLoading, setPinLoading]       = useState(false);
  const [isMobile, setIsMobile]           = useState(window.innerWidth <= 768);
  const dragId = useRef(null);

  const [form, setForm] = useState({
    name: '', phone: '', order_text: '', pickup: '', notes: '',
  });

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (view === 'staff' && pin) loadOrders();
  }, [view, pin]);

  useEffect(() => {
    if (view !== 'staff' || !pin) return;
    const t = setInterval(loadOrders, 20000);
    return () => clearInterval(t);
  }, [view, pin]);

  async function loadOrders() {
    const { ok, data } = await callAPI('/api/get-orders', { method: 'GET' }, pin);
    if (ok) setOrders(data.orders || []);
  }

  async function handlePinSubmit() {
    if (!pinInput.trim()) return;
    setPinLoading(true);
    setPinError('');
    const { ok } = await callAPI('/api/verify-pin', { method: 'POST', body: { pin: pinInput.trim() } });
    if (ok) { setPin(pinInput.trim()); setPinInput(''); }
    else setPinError('Incorrect PIN. Try again.');
    setPinLoading(false);
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
    const { ok } = await callAPI('/api/create-order', {
      method: 'POST',
      body: { name: form.name.trim(), phone: form.phone.trim(), order_text: form.order_text.trim(), pickup: form.pickup, notes: form.notes.trim() },
    });
    if (ok) { setSuccess(true); setForm({ name: '', phone: '', order_text: '', pickup: '', notes: '' }); }
    setSubmitting(false);
  }

  async function move(id, newStatus) {
    const order = orders.find(o => o.id === id);
    if (!order || order.status === newStatus) return;
    await callAPI('/api/update-order', { method: 'POST', body: { id, status: newStatus } }, pin);
    loadOrders();
  }

  async function del(id) {
    if (!window.confirm('Remove this order?')) return;
    await callAPI('/api/delete-order', { method: 'DELETE', body: { id } }, pin);
    loadOrders();
  }

  // ── Desktop drag ──────────────────────────────────────────────────────────
  function onDragStart(e, id) { dragId.current = id; e.dataTransfer.effectAllowed = 'move'; }
  function onDragOver(e, col) { e.preventDefault(); setDragOver(col); }
  function onDrop(e, col) {
    e.preventDefault();
    if (dragId.current) move(dragId.current, col);
    dragId.current = null; setDragOver(null);
  }

  // ── Touch drag (mobile) ───────────────────────────────────────────────────
  const touchDragId = useRef(null);

  function onTouchStart(e, id) {
    touchDragId.current = id;
  }

  function onTouchMove(e) {
    if (!touchDragId.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const col = el?.closest('[data-col-id]');
    setDragOver(col ? col.getAttribute('data-col-id') : null);
  }

  function onTouchEnd(e) {
    if (!touchDragId.current) return;
    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const col = el?.closest('[data-col-id]');
    if (col) move(touchDragId.current, col.getAttribute('data-col-id'));
    touchDragId.current = null;
    setDragOver(null);
  }

  const today = new Date().toISOString().split('T')[0];

  // ── PIN ENTRY ─────────────────────────────────────────────────────────────
  if (view === 'staff' && !pin) {
    return (
      <div style={{ fontFamily: FONT, background: '#111', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: 340 }}>
          <Logo dark />
          <div style={{ border: '2px solid #222', padding: '2rem', background: '#161616' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', color: '#666', marginBottom: '1.5rem', textAlign: 'center' }}>Staff Access</div>
            <label style={{ ...lbl, color: '#666' }}>PIN</label>
            <input type="password" inputMode="numeric" maxLength={8} value={pinInput} placeholder="Enter PIN"
              onChange={e => { setPinInput(e.target.value); setPinError(''); }}
              onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
              style={{ ...inp, background: '#1e1e1e', border: '2px solid #333', color: W, marginBottom: '1rem' }}
              autoFocus />
            {pinError && <div style={{ fontSize: '0.75rem', color: '#cc4444', fontWeight: 700, marginBottom: '0.75rem' }}>{pinError}</div>}
            <button onClick={handlePinSubmit} disabled={pinLoading} style={{ ...btnBlack, opacity: pinLoading ? 0.6 : 1 }}>
              {pinLoading ? 'Checking...' : 'Enter'}
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <span onClick={() => setView('customer')} style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#333', cursor: 'pointer' }}>
              ← Back to Order Form
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── ARCHIVE VIEW ──────────────────────────────────────────────────────────
  if (view === 'staff' && pin && archiveView) {
    const q = archiveSearch.toLowerCase().trim();
    const archived = orders
      .filter(o => o.status === 'picked_up')
      .filter(o => !q || [o.name, o.phone, o.order_text, o.notes, o.pickup].some(f => (f || '').toLowerCase().includes(q)))
      .sort((a, b) => b.created_at - a.created_at);
    return (
      <div style={{ fontFamily: FONT, background: '#111', minHeight: '100vh', color: W, padding: '1rem', boxSizing: 'border-box' }}>
        <StaffHeader orders={orders} onRefresh={loadOrders}
          onLock={() => { setPin(''); setView('customer'); }}
          archiveView={archiveView} setArchiveView={setArchiveView} />
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
            <input type="text" placeholder="Search by name, phone, item, date…" value={archiveSearch}
              onChange={e => setArchiveSearch(e.target.value)}
              style={{ display: 'block', width: '100%', height: 48, background: '#161616', border: '1px solid #333', color: W, fontFamily: FONT, fontSize: '0.9rem', fontWeight: 500, padding: '0 2.5rem 0 1rem', boxSizing: 'border-box', outline: 'none', borderRadius: 0 }} />
            {archiveSearch && (
              <button onClick={() => setArchiveSearch('')}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#555', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#aaa'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}>×</button>
            )}
          </div>
          <div style={{ fontSize: '0.62rem', color: '#444', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            {q ? `${archived.length} result${archived.length !== 1 ? 's' : ''} for "${archiveSearch}"` : `${archived.length} orders`}
          </div>
          {archived.length === 0 && (
            <div style={{ textAlign: 'center', color: '#333', fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '4rem' }}>
              {q ? 'No matching orders' : 'No picked up orders yet'}
            </div>
          )}
          {archived.map(o => (
            <div key={o.id} style={{ background: '#161616', border: '1px solid #222', padding: '1rem 1.25rem', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 900, fontSize: '0.9rem' }}>{o.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#666' }}>{o.phone}</div>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#aaa', marginBottom: '0.35rem', lineHeight: 1.4 }}>{o.order_text}</div>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.68rem', color: '#555' }}>Pickup: {formatPickup(o.pickup)}</div>
                  <div style={{ fontSize: '0.68rem', color: '#444' }}>Ordered: {formatTime(o.created_at)}</div>
                </div>
                {o.notes && <div style={{ fontSize: '0.72rem', color: '#555', fontStyle: 'italic', marginTop: '0.25rem' }}>{o.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button onClick={() => move(o.id, 'received')}
                  style={{ background: 'none', border: '1px solid #333', color: '#555', fontFamily: FONT, fontSize: '0.58rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.3rem 0.5rem', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#ccc'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#555'; }}>
                  Restore
                </button>
                <button onClick={() => del(o.id)}
                  style={{ background: 'none', border: 'none', color: '#3a3a3a', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: '0 0.25rem' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#cc3333'}
                  onMouseLeave={e => e.currentTarget.style.color = '#3a3a3a'}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── STAFF BOARD ───────────────────────────────────────────────────────────
  if (view === 'staff' && pin) {
    const activeOrders = orders.filter(o => o.status !== 'picked_up');
    const gridCols = isMobile ? '1fr' : 'repeat(4, minmax(220px, 1fr))';

    return (
      <div style={{ fontFamily: FONT, background: '#111', minHeight: '100vh', color: W, padding: '1rem', boxSizing: 'border-box', width: '100%' }}>
        <StaffHeader orders={orders} onRefresh={loadOrders}
          onLock={() => { setPin(''); setView('customer'); }}
          archiveView={archiveView} setArchiveView={setArchiveView} />

        <div style={{ width: '100%', overflowX: isMobile ? 'visible' : 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0.65rem', minWidth: isMobile ? 'auto' : '880px' }}>
            {COLS.map(col => {
              const cards = activeOrders.filter(o => o.status === col.id);
              const over  = dragOver === col.id;
              return (
                <div key={col.id}
                  data-col-id={col.id}
                  style={{ background: over ? '#1c1c1c' : '#161616', border: over ? '2px dashed #555' : '2px solid #222', minHeight: isMobile ? 'auto' : 420, display: 'flex', flexDirection: 'column' }}
                  onDragOver={e => onDragOver(e, col.id)}
                  onDrop={e => onDrop(e, col.id)}
                  onDragLeave={() => setDragOver(null)}>
                  <div style={{ background: col.bg, padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', color: col.fg }}>{col.label}</span>
                    <span style={{ background: 'rgba(255,255,255,0.18)', color: W, fontSize: '0.7rem', fontWeight: 900, padding: '0.1rem 0.5rem', borderRadius: 99 }}>{cards.length}</span>
                  </div>
                  <div style={{ padding: '0.65rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    {cards.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#2a2a2a', fontSize: '0.7rem', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '1.5rem', marginBottom: '1.5rem' }}>Empty</div>
                    )}
                    {cards.map(o => (
                      <div key={o.id} draggable
                        onDragStart={e => onDragStart(e, o.id)}
                        onTouchStart={e => onTouchStart(e, o.id)}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        style={{ background: '#1e1e1e', border: '1px solid #2e2e2e', padding: '0.85rem', cursor: isMobile ? 'pointer' : 'grab', userSelect: 'none', touchAction: 'none' }}
                        onMouseEnter={e => !isMobile && (e.currentTarget.style.borderColor = '#555')}
                        onMouseLeave={e => !isMobile && (e.currentTarget.style.borderColor = '#2e2e2e')}>
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
                          <div style={{ fontSize: '0.58rem', color: '#444' }}>{formatTime(o.created_at)}</div>
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
                          <button onClick={() => move(o.id, 'picked_up')}
                            style={{ flex: 1, background: 'none', border: '1px solid #2e2e2e', color: '#555', fontFamily: FONT, fontSize: '0.55rem', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.28rem 0.2rem', cursor: 'pointer', minWidth: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#ccc'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.color = '#555'; }}>
                            DONE
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Archive drop column */}
            <div
              data-col-id="picked_up"
              style={{ background: dragOver === 'picked_up' ? '#1a1a1a' : '#141414', border: dragOver === 'picked_up' ? '2px dashed #888' : '2px dashed #222', minHeight: isMobile ? 120 : 420, display: 'flex', flexDirection: 'column', transition: 'all 0.15s' }}
              onDragOver={e => onDragOver(e, 'picked_up')}
              onDrop={e => onDrop(e, 'picked_up')}
              onDragLeave={() => setDragOver(null)}>
              <div style={{ background: '#1a1a1a', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', color: dragOver === 'picked_up' ? '#888' : '#444' }}>Order Picked Up</span>
                <span style={{ background: 'rgba(255,255,255,0.05)', color: '#444', fontSize: '0.7rem', fontWeight: 900, padding: '0.1rem 0.5rem', borderRadius: 99 }}>
                  {orders.filter(o => o.status === 'picked_up').length}
                </span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: '0.85rem', padding: isMobile ? '1rem' : '2rem' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke={dragOver === 'picked_up' ? '#888' : '#2a2a2a'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: 'stroke 0.15s', flexShrink: 0 }}>
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
                <div style={{ fontSize: '0.62rem', color: dragOver === 'picked_up' ? '#777' : '#2a2a2a', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.8, transition: 'color 0.15s' }}>
                  {isMobile ? 'Tap DONE on a card to archive' : (dragOver === 'picked_up' ? 'Drop to archive' : 'Drag here\nwhen picked up')}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────
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

  // ── CUSTOMER FORM ─────────────────────────────────────────────────────────
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
              placeholder="e.g. 2kg boerewors, 1kg biltong (sliced thin), 0.5kg droewors"
              onChange={e => setForm(f => ({ ...f, order_text: e.target.value }))} />
            {errors.order_text && <div style={{ fontSize: '0.72rem', color: '#cc0000', marginTop: '0.35rem', fontWeight: 700 }}>Please tell us what you would like to order.</div>}
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
