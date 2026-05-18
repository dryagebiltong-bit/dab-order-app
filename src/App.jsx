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
const INDIGO   = '#818cf8';
const RED      = '#f87171';

const PICKUP_COLS = [
  { id: 'received',  label: 'New Order',       color: AMBER,  dim: 'rgba(245,158,11,0.12)' },
  { id: 'preparing', label: 'Preparing',        color: INDIGO, dim: 'rgba(129,140,248,0.12)' },
  { id: 'ready',     label: 'Ready for Pickup', color: GREEN,  dim: 'rgba(52,211,153,0.12)' },
];

// Delivery only has 2 active columns — no Shipped column
const DEL_COLS = [
  { id: 'del_received',  label: 'New Order',  color: AMBER,  dim: 'rgba(245,158,11,0.12)' },
  { id: 'del_preparing', label: 'Preparing',  color: INDIGO, dim: 'rgba(129,140,248,0.12)' },
];

const PICKUP_STATUSES  = new Set(['received', 'preparing', 'ready']);
const DEL_STATUSES     = new Set(['del_received', 'del_preparing']);
// del_shipped treated as archive for any existing orders
const ARCHIVE_STATUSES = new Set(['picked_up', 'delivered', 'del_shipped']);

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
  const [y, mo, day] = d.split('-');
  return new Date(Number(y), Number(mo) - 1, Number(day)).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}
function formatTime(ts) {
  return new Date(ts).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
async function callAPI(path, options = {}, pin = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (pin) headers['x-staff-pin'] = pin;
  const res = await fetch(path, { ...options, headers, body: options.body ? JSON.stringify(options.body) : undefined });
  return { ok: res.ok, data: await res.json() };
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
      .sheet  { animation: slideUp 0.28s cubic-bezier(0.32,0.72,0,1) both; }
      .fade   { animation: fadeIn  0.2s ease both; }
      .card   { animation: cardIn  0.18s ease both; }
      .shake  { animation: shake   0.35s ease both; }
      .btn-tap { -webkit-tap-highlight-color: transparent; transition: opacity 0.12s, transform 0.1s; }
      .btn-tap:active { opacity: 0.75; transform: scale(0.97); }
    `;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
  return null;
}

// ── TRACKING INPUT STEP ────────────────────────────────────────────────────────
function TrackingStep({ order, onConfirm, onBack }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  function confirm() {
    if (!value.trim()) { setError(true); return; }
    onConfirm(value.trim());
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button className="btn-tap" onClick={onBack}
          style={{ background: 'none', border: 'none', color: T2, cursor: 'pointer', fontSize: '1.2rem', padding: 0, lineHeight: 1 }}>
          ←
        </button>
        <div>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: T3 }}>Shipping</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: T1 }}>{order.name}</div>
        </div>
      </div>

      {/* Instruction */}
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${AMBER}`, borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: AMBER, marginBottom: '0.4rem' }}>
          📮 Enter AusPost Tracking Number
        </div>
        <div style={{ fontSize: '0.85rem', color: T2, lineHeight: 1.6 }}>
          Enter the tracking number from the AusPost receipt. The customer will automatically receive an SMS with a tracking link.
        </div>
      </div>

      {/* Input */}
      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: T2, marginBottom: '0.5rem' }}>
        Tracking Number
      </label>
      <input
        className={error ? 'shake' : ''}
        type="text"
        value={value}
        onChange={e => { setValue(e.target.value.toUpperCase()); setError(false); }}
        placeholder="e.g. 33N00012345678901234"
        autoFocus
        style={{
          display: 'block', width: '100%', height: 56,
          background: BG, border: `2px solid ${error ? RED : (value ? AMBER : BORDER)}`,
          color: T1, fontFamily: MONO, fontSize: '1rem', fontWeight: 700,
          padding: '0 1rem', borderRadius: '10px', outline: 'none',
          letterSpacing: '1.5px', marginBottom: error ? '0.4rem' : '1.5rem',
          transition: 'border-color 0.15s',
        }} />
      {error && <div style={{ fontSize: '0.75rem', color: RED, fontWeight: 700, marginBottom: '1.25rem' }}>Please enter the tracking number.</div>}

      {/* Confirm */}
      <button className="btn-tap" onClick={confirm}
        style={{
          display: 'block', width: '100%', height: 62,
          background: GREEN, color: '#000',
          border: 'none', borderRadius: '12px',
          fontFamily: FONT, fontSize: '1rem', fontWeight: 900,
          letterSpacing: '0.5px', cursor: 'pointer',
          marginBottom: '0.75rem',
        }}>
        ✓ Confirm & Send Tracking to Customer
      </button>
      <button className="btn-tap" onClick={onBack}
        style={{ display: 'block', width: '100%', height: 48, background: 'none', border: `1px solid ${BORDER}`, color: T3, borderRadius: '10px', fontFamily: FONT, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  );
}

// ── ORDER DETAIL MODAL ─────────────────────────────────────────────────────────
function OrderModal({ order, cols, archiveColId, isDelivery, onMove, onDel, onClose }) {
  const [trackingStep, setTrackingStep] = useState(false);

  const col       = cols.find(c => c.id === order.status);
  const colIdx    = cols.findIndex(c => c.id === order.status);
  const nextCol   = cols[colIdx + 1] || null;
  const isLastCol = colIdx === cols.length - 1;

  const fullAddress = [
    order.address_line1,
    order.address_line2,
    [order.city, order.state_au, order.postcode].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n');

  function handleShip(trackingNumber) {
    onMove(order.id, 'delivered', trackingNumber);
    onClose();
  }

  if (trackingStep) {
    return (
      <div className="fade" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
        <div className="sheet" style={{ position: 'relative', background: SURFACE, borderRadius: '20px 20px 0 0', maxHeight: '92vh', overflow: 'auto' }}>
          <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 40, height: 4, background: BORDER, borderRadius: 2 }} />
          </div>
          <TrackingStep order={order} onConfirm={handleShip} onBack={() => setTrackingStep(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="fade" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
      <div className="sheet" style={{ position: 'relative', background: SURFACE, borderRadius: '20px 20px 0 0', padding: '0 0 env(safe-area-inset-bottom)', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: BORDER, borderRadius: 2 }} />
        </div>

        {/* Scrollable content */}
        <div style={{ overflow: 'auto', flex: 1, padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: T1, lineHeight: 1.2, marginBottom: '0.35rem' }}>{order.name}</div>
              <a href={`tel:${order.phone}`} style={{ fontSize: '1.1rem', fontWeight: 700, color: BLUE, textDecoration: 'none' }}>{order.phone}</a>
            </div>
            <div style={{ textAlign: 'right' }}>
              {isDelivery && order.woo_order_number && (
                <div style={{ fontFamily: MONO, fontSize: '0.75rem', color: T3, marginBottom: '0.35rem' }}>#{order.woo_order_number}</div>
              )}
              {col && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: col.dim, border: `1px solid ${col.color}44`, padding: '0.3rem 0.7rem', borderRadius: '20px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: col.color }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: col.color }}>{col.label}</span>
                </div>
              )}
            </div>
          </div>

          {isDelivery && fullAddress && (
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${BLUE}`, padding: '1rem 1.1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: T3, marginBottom: '0.5rem' }}>📦 Delivery Address</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: T1, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{fullAddress}</div>
            </div>
          )}

          <div style={{ background: BG, border: `1px solid ${BORDER}`, padding: '1rem 1.1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: T3, marginBottom: '0.5rem' }}>🛍️ Order</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: T1, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{order.order_text}</div>
          </div>

          {!isDelivery && order.pickup && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: T3, marginBottom: '0.35rem' }}>📅 Pickup Date</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: AMBER }}>{formatPickup(order.pickup)}</div>
            </div>
          )}

          {order.notes && (
            <div style={{ background: BG, border: `1px solid ${BORDER}`, padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: T3, marginBottom: '0.35rem' }}>💬 Notes</div>
              <div style={{ fontSize: '0.95rem', color: T2, lineHeight: 1.6 }}>{order.notes}</div>
            </div>
          )}

          {order.tracking_number && (
            <div style={{ background: BG, border: `1px solid ${GREEN}44`, borderLeft: `4px solid ${GREEN}`, padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: GREEN, marginBottom: '0.35rem' }}>📮 Tracking Number</div>
              <div style={{ fontFamily: MONO, fontSize: '1rem', fontWeight: 700, color: T1, letterSpacing: '1.5px' }}>{order.tracking_number}</div>
            </div>
          )}

          <div style={{ fontFamily: MONO, fontSize: '0.65rem', color: T3, marginBottom: '1.5rem' }}>{formatTime(order.created_at)}</div>
        </div>

        {/* Actions */}
        <div style={{ padding: '1rem 1.5rem 1.5rem', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: '0.6rem', flexShrink: 0, background: SURFACE }}>

          {/* Delivery: last col = show ship button */}
          {isDelivery && isLastCol && (
            <button className="btn-tap" onClick={() => setTrackingStep(true)}
              style={{ height: 62, background: AMBER, color: '#000', border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '1rem', fontWeight: 900, cursor: 'pointer' }}>
              📮 Ship Order — Enter Tracking Number
            </button>
          )}

          {/* Pickup: show next col button */}
          {!isDelivery && nextCol && (
            <button className="btn-tap" onClick={() => { onMove(order.id, nextCol.id); onClose(); }}
              style={{ height: 62, background: nextCol.color, color: '#000', border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '1rem', fontWeight: 900, cursor: 'pointer' }}>
              → Mark as {nextCol.label}
            </button>
          )}

          {/* Delivery non-last col: next */}
          {isDelivery && !isLastCol && nextCol && (
            <button className="btn-tap" onClick={() => { onMove(order.id, nextCol.id); onClose(); }}
              style={{ height: 62, background: nextCol.color, color: '#000', border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '1rem', fontWeight: 900, cursor: 'pointer' }}>
              → Mark as {nextCol.label}
            </button>
          )}

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            {/* Only show Done for non-delivery-last, or for pickup */}
            {(!isDelivery || !isLastCol) && (
              <button className="btn-tap" onClick={() => { onMove(order.id, archiveColId); onClose(); }}
                style={{ flex: 1, height: 54, background: 'none', border: `2px solid ${GREEN}55`, color: GREEN, borderRadius: '12px', fontFamily: FONT, fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}>
                ✓ Done
              </button>
            )}
            <button className="btn-tap" onClick={() => { if (window.confirm('Remove this order?')) { onDel(order.id); onClose(); } }}
              style={{ flex: 1, height: 54, background: 'none', border: `2px solid ${RED}33`, color: RED, borderRadius: '12px', fontFamily: FONT, fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}>
              🗑 Delete
            </button>
          </div>

          <button className="btn-tap" onClick={onClose}
            style={{ height: 48, background: 'none', border: `1px solid ${BORDER}`, color: T3, borderRadius: '12px', fontFamily: FONT, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── COMPACT ORDER CARD ─────────────────────────────────────────────────────────
function OrderCard({ order, col, isDelivery, onClick }) {
  const suburb = isDelivery ? [order.city, order.state_au].filter(Boolean).join(', ') : null;
  return (
    <div className="card btn-tap" onClick={onClick} style={{
      background: SURFACE2, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${col.color}`,
      borderRadius: '10px', marginBottom: '0.6rem', cursor: 'pointer', overflow: 'hidden',
    }}>
      <div style={{ padding: '0.85rem 0.9rem 0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
          <div style={{ fontWeight: 900, fontSize: '1rem', color: T1, lineHeight: 1.2, flex: 1, marginRight: '0.5rem' }}>{order.name}</div>
          <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: T3, flexShrink: 0, paddingTop: '2px' }}>{timeAgo(order.created_at)}</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: '0.8rem', color: T2, marginBottom: '0.5rem' }}>{order.phone}</div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: T1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5, marginBottom: '0.6rem' }}>
          {order.order_text}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isDelivery
            ? <span style={{ fontSize: '0.75rem', color: BLUE, fontWeight: 700 }}>{suburb ? `📍 ${suburb}` : '📦 Delivery'}</span>
            : <span style={{ fontSize: '0.75rem', fontWeight: 800, color: AMBER }}>{order.pickup ? `📅 ${formatPickup(order.pickup)}` : ''}</span>
          }
          <span style={{ fontSize: '0.7rem', color: T3, fontWeight: 600 }}>Tap for details →</span>
        </div>
      </div>
    </div>
  );
}

// ── KANBAN BOARD ───────────────────────────────────────────────────────────────
function KanbanBoard({ orders, cols, archiveColId, archiveLabel, isDelivery, isMobile, dragOver, onDragOver, onDrop, onDragLeave, onDragStart, onTouchStart, onTouchMove, onTouchEnd, onMove, onDel, onCardTap }) {
  const active        = orders.filter(o => cols.some(c => c.id === o.status));
  const archivedCount = orders.filter(o => o.status === archiveColId).length;
  const colCount      = cols.length + 1;

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${colCount}, minmax(260px, 1fr))`, gap: '0.75rem', minWidth: isMobile ? 'auto' : `${colCount * 270}px`, padding: '0 1rem' }}>
        {cols.map(col => {
          const cards = active.filter(o => o.status === col.id);
          const over  = dragOver === col.id;
          return (
            <div key={col.id} data-col-id={col.id}
              onDragOver={e => onDragOver(e, col.id)} onDrop={e => onDrop(e, col.id)} onDragLeave={onDragLeave}
              style={{ background: over ? SURFACE2 : col.dim, border: `1px solid ${over ? col.color + '44' : BORDER}`, borderRadius: '12px', overflow: 'hidden', minHeight: isMobile ? 'auto' : 400, display: 'flex', flexDirection: 'column', transition: 'all 0.15s' }}>
              <div style={{ padding: '0.85rem 1rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: col.dim }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, boxShadow: `0 0 8px ${col.color}88` }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '1.5px', textTransform: 'uppercase', color: col.color }}>{col.label}</span>
                </div>
                {cards.length > 0 && (
                  <span style={{ fontFamily: MONO, fontSize: '0.85rem', fontWeight: 700, color: col.color, background: `${col.color}22`, border: `1px solid ${col.color}44`, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {cards.length}
                  </span>
                )}
              </div>
              <div style={{ padding: '0.65rem', flex: 1 }}>
                {cards.length === 0 && <div style={{ textAlign: 'center', color: T3, fontSize: '0.7rem', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2rem' }}>Empty</div>}
                {cards.map(o => (
                  <div key={o.id} draggable onDragStart={e => onDragStart(e, o.id)} onTouchStart={e => onTouchStart(e, o.id)} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={{ touchAction: 'none', userSelect: 'none' }}>
                    <OrderCard order={o} col={col} isDelivery={isDelivery} onClick={() => onCardTap(o)} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Archive drop zone */}
        <div data-col-id={archiveColId} onDragOver={e => onDragOver(e, archiveColId)} onDrop={e => onDrop(e, archiveColId)} onDragLeave={onDragLeave}
          style={{ border: `2px dashed ${dragOver === archiveColId ? T2 : BORDER}`, borderRadius: '12px', minHeight: isMobile ? 80 : 400, display: 'flex', flexDirection: 'column', background: dragOver === archiveColId ? SURFACE2 : 'transparent', transition: 'all 0.15s' }}>
          <div style={{ padding: '0.85rem 1rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3 }}>{archiveLabel}</span>
            {archivedCount > 0 && <span style={{ fontFamily: MONO, fontSize: '0.8rem', color: T3 }}>{archivedCount}</span>}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📦</span>
            <span style={{ fontSize: '0.7rem', color: dragOver === archiveColId ? T2 : T3, letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.8 }}>
              {isMobile ? 'Tap Done on a card' : (dragOver === archiveColId ? 'Release to archive' : 'Drag here\nwhen complete')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ARCHIVE LIST ───────────────────────────────────────────────────────────────
function ArchiveList({ orders, onMove, onDel }) {
  const [search, setSearch] = useState('');
  const q = search.toLowerCase().trim();
  const list = orders
    .filter(o => ARCHIVE_STATUSES.has(o.status))
    .filter(o => !q || [o.name, o.phone, o.order_text, o.city, o.woo_order_number, o.tracking_number].some(f => (f || '').toLowerCase().includes(q)))
    .sort((a, b) => b.created_at - a.created_at);

  const isDel = o => o.status === 'delivered' || o.status === 'del_shipped';

  return (
    <div style={{ padding: '1rem' }}>
      <input type="text" placeholder="Search archived orders…" value={search} onChange={e => setSearch(e.target.value)}
        style={{ display: 'block', width: '100%', height: 50, background: SURFACE, border: `1px solid ${BORDER}`, color: T1, fontFamily: FONT, fontSize: '0.95rem', padding: '0 1rem', borderRadius: '10px', outline: 'none', marginBottom: '1rem' }} />
      {list.length === 0 && <div style={{ textAlign: 'center', color: T3, marginTop: '3rem', fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase' }}>{q ? 'No results' : 'No archived orders yet'}</div>}
      {list.map(o => (
        <div key={o.id} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${isDel(o) ? BLUE : AMBER}`, borderRadius: '10px', padding: '1rem 1.1rem', marginBottom: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <span style={{ fontWeight: 900, fontSize: '1rem', color: T1 }}>{o.name}</span>
              <span style={{ fontFamily: MONO, fontSize: '0.75rem', color: T2 }}>{o.phone}</span>
              <span style={{ fontSize: '0.58rem', fontWeight: 800, padding: '0.15rem 0.5rem', border: `1px solid ${isDel(o) ? BLUE : AMBER}44`, color: isDel(o) ? BLUE : AMBER, borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isDel(o) ? 'Delivery' : 'Pickup'}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: T2, lineHeight: 1.5, marginBottom: '0.35rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {o.order_text}
            </div>
            {o.tracking_number && (
              <div style={{ fontFamily: MONO, fontSize: '0.7rem', color: GREEN, marginBottom: '0.25rem' }}>
                📮 {o.tracking_number}
              </div>
            )}
            <div style={{ fontFamily: MONO, fontSize: '0.65rem', color: T3 }}>{formatTime(o.created_at)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
            <button className="btn-tap" onClick={() => onMove(o.id, isDel(o) ? 'del_received' : 'received')}
              style={{ background: 'none', border: `1px solid ${BORDER}`, color: T2, fontFamily: FONT, fontSize: '0.7rem', fontWeight: 700, padding: '0.4rem 0.65rem', cursor: 'pointer', borderRadius: '6px', whiteSpace: 'nowrap' }}>
              Restore
            </button>
            <button className="btn-tap" onClick={() => onDel(o.id)}
              style={{ background: 'none', border: 'none', color: T3, fontSize: '1.2rem', cursor: 'pointer', textAlign: 'center', borderRadius: '6px', padding: '0.2rem' }}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]           = useState('customer');
  const [orders, setOrders]       = useState([]);
  const [activeTab, setActiveTab] = useState('pickup');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [success, setSuccess]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]       = useState({});
  const [dragOver, setDragOver]   = useState(null);
  const [pin, setPin]             = useState('');
  const [pinInput, setPinInput]   = useState('');
  const [pinError, setPinError]   = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isMobile, setIsMobile]   = useState(window.innerWidth <= 768);
  const dragId      = useRef(null);
  const touchDragId = useRef(null);

  const [form, setForm] = useState({ name: '', phone: '', order_text: '', pickup: '', notes: '' });

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => { if (view === 'staff' && pin) loadOrders(); }, [view, pin]);
  useEffect(() => {
    if (view !== 'staff' || !pin) return;
    const t = setInterval(loadOrders, 20000);
    return () => clearInterval(t);
  }, [view, pin]);

  async function loadOrders() {
    const { ok, data } = await callAPI('/api/get-orders', { method: 'GET' }, pin);
    if (ok) setOrders(data.orders || []);
  }
  async function handleRefresh() {
    setRefreshing(true);
    await loadOrders();
    setTimeout(() => setRefreshing(false), 600);
  }
  async function handlePinSubmit() {
    if (!pinInput.trim()) return;
    setPinLoading(true); setPinError('');
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

  // move accepts optional trackingNumber for delivery ship flow
  async function move(id, newStatus, trackingNumber = null) {
    const order = orders.find(o => o.id === id);
    if (!order || order.status === newStatus) return;
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus, ...(trackingNumber ? { tracking_number: trackingNumber } : {}) } : o));
    const body = { id, status: newStatus };
    if (trackingNumber) body.tracking_number = trackingNumber;
    callAPI('/api/update-order', { method: 'POST', body }, pin);
  }

  async function del(id) {
    setOrders(prev => prev.filter(o => o.id !== id));
    callAPI('/api/delete-order', { method: 'DELETE', body: { id } }, pin);
  }

  function onDragStart(e, id) { dragId.current = id; e.dataTransfer.effectAllowed = 'move'; }
  function onDragOver(e, col) { e.preventDefault(); setDragOver(col); }
  function onDrop(e, col) { e.preventDefault(); if (dragId.current) move(dragId.current, col); dragId.current = null; setDragOver(null); }
  function onDragLeave() { setDragOver(null); }
  function onTouchStart(e, id) { touchDragId.current = id; }
  function onTouchMove(e) {
    if (!touchDragId.current) return;
    e.preventDefault();
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const col = el?.closest('[data-col-id]');
    setDragOver(col ? col.getAttribute('data-col-id') : null);
  }
  function onTouchEnd(e) {
    if (!touchDragId.current) return;
    const t = e.changedTouches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const col = el?.closest('[data-col-id]');
    if (col) move(touchDragId.current, col.getAttribute('data-col-id'));
    touchDragId.current = null; setDragOver(null);
  }

  const pickupActive   = orders.filter(o => PICKUP_STATUSES.has(o.status)).length;
  const deliveryActive = orders.filter(o => DEL_STATUSES.has(o.status)).length;
  const archived       = orders.filter(o => ARCHIVE_STATUSES.has(o.status)).length;
  const today          = new Date().toISOString().split('T')[0];
  const m              = isMobile;

  const boardProps = {
    orders, isMobile, dragOver,
    onDragOver, onDrop, onDragLeave,
    onDragStart, onTouchStart, onTouchMove, onTouchEnd,
    onMove: move, onDel: del,
    onCardTap: setSelectedOrder,
  };

  // ── PIN ───────────────────────────────────────────────────────────────────────
  if (view === 'staff' && !pin) {
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
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: T2, marginBottom: '0.5rem' }}>PIN</label>
              <input type="password" inputMode="numeric" maxLength={8} value={pinInput} placeholder="Enter PIN"
                onChange={e => { setPinInput(e.target.value); setPinError(''); }}
                onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                style={{ display: 'block', width: '100%', height: 56, background: BG, border: `1.5px solid ${BORDER}`, color: T1, fontFamily: FONT, fontSize: '1.3rem', letterSpacing: '6px', padding: '0 1rem', borderRadius: '10px', outline: 'none', marginBottom: '0.75rem' }}
                autoFocus />
              {pinError && <div style={{ fontSize: '0.8rem', color: RED, fontWeight: 700, marginBottom: '0.75rem' }}>{pinError}</div>}
              <button className="btn-tap" onClick={handlePinSubmit} disabled={pinLoading}
                style={{ display: 'block', width: '100%', height: 56, background: T1, color: BG, border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '0.9rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: pinLoading ? 0.6 : 1 }}>
                {pinLoading ? '...' : 'Enter'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <span onClick={() => setView('customer')} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: T3, cursor: 'pointer' }}>← Back to Order Form</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── STAFF BOARD ──────────────────────────────────────────────────────────────
  if (view === 'staff' && pin) {
    const tabs = [
      { id: 'pickup',   label: 'Pickup Orders',  count: pickupActive,   color: AMBER },
      { id: 'delivery', label: 'Delivery Orders', count: deliveryActive, color: BLUE  },
      { id: 'archive',  label: 'Archive',         count: archived,       color: T3    },
    ];

    return (
      <>
        <GlobalStyles />
        <div style={{ position: 'sticky', top: 0, zIndex: 100, background: BG, borderBottom: `1px solid ${BORDER}`, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>{LOGO_URL ? <img src={LOGO_URL} alt="" style={{ height: 36, filter: 'invert(1)', width: 'auto' }} /> : <span style={{ fontSize: '0.9rem', fontWeight: 900, color: T1, letterSpacing: '2px', textTransform: 'uppercase' }}>DAB</span>}</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-tap" onClick={handleRefresh} style={{ height: 40, padding: '0 1rem', background: SURFACE, border: `1px solid ${BORDER}`, color: T2, fontFamily: FONT, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px' }}>
              {refreshing ? '...' : '↻ Refresh'}
            </button>
            <button className="btn-tap" onClick={() => { setPin(''); setView('customer'); }} style={{ height: 40, padding: '0 1rem', background: 'none', border: `1px solid ${BORDER}`, color: T3, fontFamily: FONT, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '8px' }}>
              Lock
            </button>
          </div>
        </div>

        <div style={{ position: 'sticky', top: '57px', zIndex: 99, background: BG, borderBottom: `1px solid ${BORDER}`, display: 'flex' }}>
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} className="btn-tap" onClick={() => setActiveTab(tab.id)}
                style={{ flex: 1, height: 60, background: 'none', border: 'none', borderBottom: `3px solid ${active ? tab.color : 'transparent'}`, cursor: 'pointer', fontFamily: FONT, padding: '0 0.5rem', transition: 'border-color 0.15s' }}>
                <div style={{ fontSize: m ? '0.7rem' : '0.85rem', fontWeight: 900, color: active ? tab.color : T3, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{tab.label}</div>
                {tab.count > 0 && <span style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700, color: active ? tab.color : T3, background: active ? `${tab.color}22` : 'none', padding: '0.05rem 0.45rem', borderRadius: '12px' }}>{tab.count}</span>}
              </button>
            );
          })}
        </div>

        <div style={{ paddingTop: '0.85rem', paddingBottom: '2rem', minHeight: 'calc(100vh - 120px)' }}>
          {activeTab === 'pickup'   && <KanbanBoard cols={PICKUP_COLS} archiveColId="picked_up" archiveLabel="Picked Up" isDelivery={false} {...boardProps} />}
          {activeTab === 'delivery' && <KanbanBoard cols={DEL_COLS}    archiveColId="delivered"  archiveLabel="Delivered"  isDelivery={true}  {...boardProps} />}
          {activeTab === 'archive'  && <ArchiveList orders={orders} onMove={move} onDel={del} />}
        </div>

        {selectedOrder && (() => {
          const isDelivery = DEL_STATUSES.has(selectedOrder.status) || ARCHIVE_STATUSES.has(selectedOrder.status);
          const cols       = isDelivery ? DEL_COLS : PICKUP_COLS;
          const archiveId  = isDelivery ? 'delivered' : 'picked_up';
          return (
            <OrderModal
              order={selectedOrder} cols={cols} archiveColId={archiveId} isDelivery={isDelivery}
              onMove={(id, status, tracking) => {
                move(id, status, tracking);
                setSelectedOrder(null);
              }}
              onDel={id => { del(id); setSelectedOrder(null); }}
              onClose={() => setSelectedOrder(null)} />
          );
        })()}
      </>
    );
  }

  // ── SUCCESS ──────────────────────────────────────────────────────────────────
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
              <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1.75rem', lineHeight: 1.7 }}>We've received your order and sent you a confirmation SMS. We'll text you when it's ready for pickup.</p>
              <button className="btn-tap" onClick={() => setSuccess(false)} style={{ display: 'block', width: '100%', height: 54, background: '#111827', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '0.9rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}>
                Place Another Order
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <span onClick={() => setView('staff')} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#9ca3af', cursor: 'pointer' }}>Staff View</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── CUSTOMER FORM ────────────────────────────────────────────────────────────
  const inp = { display: 'block', width: '100%', height: m ? 48 : 52, border: '1.5px solid #d1d5db', background: '#fff', color: '#111827', fontFamily: FONT, fontSize: '1rem', fontWeight: 600, padding: '0 1rem', boxSizing: 'border-box', outline: 'none', borderRadius: '10px', appearance: 'none', WebkitAppearance: 'none' };
  const lbl = { display: 'block', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '0.45rem', color: '#374151' };

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
              <input style={{ ...inp, borderColor: errors.name ? '#ef4444' : '#d1d5db' }} value={form.name} placeholder="Full name" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={lbl}>Phone Number</label>
              <input style={{ ...inp, borderColor: errors.phone ? '#ef4444' : '#d1d5db' }} value={form.phone} placeholder="04XX XXX XXX" type="tel" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.3rem' }}>We'll SMS you when your order is ready.</div>
            </div>
            <div style={{ borderTop: '1px solid #f3f4f6', margin: '1.25rem 0' }} />
            <div style={{ marginBottom: '1rem' }}>
              <label style={lbl}>What would you like?</label>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.4rem' }}>Include quantity in kg</div>
              <textarea style={{ ...inp, height: 'auto', minHeight: m ? 80 : 110, padding: '0.75rem 1rem', resize: 'vertical', borderColor: errors.order_text ? '#ef4444' : '#d1d5db' }}
                value={form.order_text} placeholder="e.g. 2kg boerewors, 1kg biltong (sliced thin)" onChange={e => setForm(f => ({ ...f, order_text: e.target.value }))} />
              {errors.order_text && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem', fontWeight: 700 }}>Please enter your order.</div>}
            </div>
            <div style={{ borderTop: '1px solid #f3f4f6', margin: '1.25rem 0' }} />
            <div style={{ marginBottom: '1rem' }}>
              <label style={lbl}>Pickup Date</label>
              <input type="date" style={{ ...inp, borderColor: errors.pickup ? '#ef4444' : '#d1d5db' }} value={form.pickup} min={today} onChange={e => setForm(f => ({ ...f, pickup: e.target.value }))} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={lbl}>Notes (optional)</label>
              <textarea style={{ ...inp, height: 'auto', minHeight: m ? 60 : 80, padding: '0.75rem 1rem', resize: 'vertical' }}
                value={form.notes} placeholder="Any special requests…" onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            {Object.keys(errors).filter(k => k !== 'order_text').length > 0 && <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 700, marginBottom: '0.75rem' }}>Please fill in all required fields.</div>}
            <button className="btn-tap" onClick={submit} disabled={submitting}
              style={{ display: 'block', width: '100%', height: m ? 52 : 56, background: '#111827', color: '#fff', border: 'none', borderRadius: '12px', fontFamily: FONT, fontSize: '0.95rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Placing Order…' : 'Place Order'}
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '1.25rem', paddingBottom: '1.5rem' }}>
            <span onClick={() => setView('staff')} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#9ca3af', cursor: 'pointer', userSelect: 'none' }}>Staff View</span>
          </div>
        </div>
      </div>
    </>
  );
}
