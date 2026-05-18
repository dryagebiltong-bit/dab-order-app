import { useState, useEffect, useRef, useCallback } from 'react';

const LOGO_URL = 'https://dryagebiltong.com.au/wp-content/uploads/2026/05/download.png';

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const C = {
  bg:           '#0d1117',
  surface:      '#141922',
  surface2:     '#1a2130',
  surface3:     '#1f2840',
  border:       '#1e2535',
  borderHover:  '#2e3850',
  text1:        '#eef0f6',
  text2:        '#7b849e',
  text3:        '#3a4258',
  amber:        '#f59e0b',
  amberDim:     'rgba(245,158,11,0.10)',
  amberGlow:    'rgba(245,158,11,0.20)',
  indigo:       '#818cf8',
  indigoDim:    'rgba(129,140,248,0.10)',
  emerald:      '#34d399',
  emeraldDim:   'rgba(52,211,153,0.10)',
  orange:       '#fb923c',
  orangeDim:    'rgba(251,146,60,0.10)',
  red:          '#f87171',
  blue:         '#60a5fa',
  blueDim:      'rgba(96,165,250,0.10)',
};

const FONT      = '"DM Sans", sans-serif';
const MONO      = '"SF Mono", "Fira Mono", monospace';

// ── COLUMN CONFIGS ─────────────────────────────────────────────────────────────
const PICKUP_COLS = [
  { id: 'received',  label: 'Order Received',  short: 'RECEIVED', color: C.amber,   dim: C.amberDim,   glow: C.amberGlow  },
  { id: 'preparing', label: 'Preparing',        short: 'PREPARING', color: C.indigo,  dim: C.indigoDim,  glow: 'rgba(129,140,248,0.15)' },
  { id: 'ready',     label: 'Ready for Pickup', short: 'READY',     color: C.emerald, dim: C.emeraldDim, glow: 'rgba(52,211,153,0.15)' },
];

const DEL_COLS = [
  { id: 'del_received',  label: 'Order Received', short: 'RECEIVED', color: C.amber,   dim: C.amberDim,   glow: C.amberGlow },
  { id: 'del_preparing', label: 'Preparing',       short: 'PREPARING', color: C.indigo,  dim: C.indigoDim,  glow: 'rgba(129,140,248,0.15)' },
  { id: 'del_shipped',   label: 'Shipped',         short: 'SHIPPED',   color: C.orange,  dim: C.orangeDim,  glow: 'rgba(251,146,60,0.15)' },
];

const PICKUP_STATUSES  = new Set(['received', 'preparing', 'ready']);
const DEL_STATUSES     = new Set(['del_received', 'del_preparing', 'del_shipped']);
const ARCHIVE_STATUSES = new Set(['picked_up', 'delivered']);

// ── HELPERS ────────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1)  return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function isNew(ts) {
  return Date.now() - ts < 5 * 60 * 1000;
}

function formatPickup(d) {
  if (!d) return '';
  const [y, mo, day] = d.split('-');
  return new Date(Number(y), Number(mo) - 1, Number(day)).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
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

// ── GLOBAL STYLES INJECTION ────────────────────────────────────────────────────
function useGlobalStyles() {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = `
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: ${C.bg}; }
      ::-webkit-scrollbar { width: 3px; height: 3px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #2a3040; border-radius: 8px; }

      @keyframes fadeSlide {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulseNew {
        0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
        50%       { box-shadow: 0 0 0 6px rgba(245,158,11,0.12); }
      }
      @keyframes breathe {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.55; }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .card-anim   { animation: fadeSlide 0.22s ease both; }
      .card-new    { animation: pulseNew 2.5s ease infinite; }
      .dot-new     { animation: breathe 1.4s ease infinite; }
      .spin        { animation: spin 0.7s linear infinite; }

      .action-btn  { transition: background 0.12s, color 0.12s, border-color 0.12s, transform 0.1s; }
      .action-btn:active { transform: scale(0.96); }
      .card-wrap   { transition: border-color 0.15s, box-shadow 0.15s; }
    `;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
}

// ── LIVE TICK ──────────────────────────────────────────────────────────────────
function useTick(ms = 30000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return tick;
}

// ── LOGO ───────────────────────────────────────────────────────────────────────
function Logo({ size = 48, invert = true }) {
  return LOGO_URL
    ? <img src={LOGO_URL} alt="Dry Age Biltong" style={{ height: size, width: 'auto', filter: invert ? 'invert(1)' : 'none', display: 'block' }} />
    : <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: '1rem', letterSpacing: '2px', textTransform: 'uppercase', color: C.text1 }}>DAB</span>;
}

// ── STAT CHIP ──────────────────────────────────────────────────────────────────
function StatChip({ label, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontFamily: MONO, fontSize: '1.1rem', fontWeight: 600, color: C.text1, lineHeight: 1 }}>{count}</span>
      <span style={{ fontFamily: FONT, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.text2 }}>{label}</span>
    </div>
  );
}

// ── HEADER ─────────────────────────────────────────────────────────────────────
function Header({ orders, onRefresh, onLock, archiveView, setArchiveView, refreshing }) {
  const pickup   = orders.filter(o => PICKUP_STATUSES.has(o.status)).length;
  const delivery = orders.filter(o => DEL_STATUSES.has(o.status)).length;
  const archived = orders.filter(o => ARCHIVE_STATUSES.has(o.status)).length;

  const btn = {
    background: 'none', border: `1px solid ${C.border}`, color: C.text2,
    fontFamily: FONT, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.5px',
    textTransform: 'uppercase', padding: '0.5rem 0.85rem', cursor: 'pointer',
    borderRadius: '4px', whiteSpace: 'nowrap',
  };

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: `linear-gradient(180deg, ${C.bg} 0%, rgba(13,17,23,0.97) 100%)`,
      borderBottom: `1px solid ${C.border}`,
      backdropFilter: 'blur(12px)',
      padding: '0.75rem 1.25rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Logo size={42} />
        <div style={{ width: 1, height: 32, background: C.border }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <span style={{ fontFamily: FONT, fontSize: '0.52rem', fontWeight: 800, letterSpacing: '2.5px', textTransform: 'uppercase', color: C.text3 }}>
            {archiveView ? 'Archive' : 'Order Board'}
          </span>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {archiveView ? (
              <StatChip label="Archived" count={archived} color={C.text3} />
            ) : (
              <>
                <StatChip label="Pickup"   count={pickup}   color={C.amber}  />
                <div style={{ width: 1, height: 14, background: C.border }} />
                <StatChip label="Delivery" count={delivery} color={C.blue}   />
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="action-btn"
          onClick={() => setArchiveView(v => !v)}
          style={{ ...btn, borderColor: archiveView ? C.borderHover : C.border, color: archiveView ? C.text1 : C.text2 }}>
          {archiveView ? '← Board' : `Archive (${archived})`}
        </button>
        <button className="action-btn" onClick={onRefresh} style={btn}>
          <span className={refreshing ? 'spin' : ''} style={{ display: 'inline-block' }}>↻</span>
          {' '}Refresh
        </button>
        <button className="action-btn" onClick={onLock} style={{ ...btn, borderColor: '#3a2020', color: '#8a5050' }}>
          Lock
        </button>
      </div>
    </header>
  );
}

// ── COLUMN HEADER ──────────────────────────────────────────────────────────────
function ColHeader({ col, count }) {
  return (
    <div style={{
      padding: '0.75rem 1rem',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: col.dim,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, boxShadow: `0 0 6px ${col.color}` }} />
        <span style={{ fontFamily: FONT, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: col.color }}>
          {col.label}
        </span>
      </div>
      {count > 0 && (
        <span style={{
          fontFamily: MONO, fontSize: '0.75rem', fontWeight: 600, color: col.color,
          background: col.glow, padding: '0.1rem 0.5rem', borderRadius: '12px',
          border: `1px solid ${col.glow}`,
        }}>{count}</span>
      )}
    </div>
  );
}

// ── PICKUP CARD ────────────────────────────────────────────────────────────────
function PickupCard({ o, col, allCols, archiveColId, isMobile, onMove, onDel, onDragStart, onTouchStart, onTouchMove, onTouchEnd }) {
  useTick(30000);
  const fresh = isNew(o.created_at);

  const card = {
    background: C.surface,
    borderLeft: `3px solid ${col.color}`,
    borderRight: `1px solid ${C.border}`,
    borderTop: `1px solid ${C.border}`,
    borderBottom: `1px solid ${C.border}`,
    marginBottom: '0.5rem',
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    overflow: 'hidden',
  };

  const moveBtn = (c) => ({
    flex: 1, height: 40,
    background: 'none',
    border: `1px solid ${C.border}`,
    color: C.text2,
    fontFamily: FONT, fontSize: '0.58rem', fontWeight: 800,
    letterSpacing: '1.5px', textTransform: 'uppercase',
    cursor: 'pointer', minWidth: 0,
  });

  return (
    <div
      className={`card-wrap card-anim${fresh ? ' card-new' : ''}`}
      draggable
      onDragStart={e => onDragStart(e, o.id)}
      onTouchStart={e => onTouchStart(e, o.id)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={card}>

      {/* Top row */}
      <div style={{ padding: '0.85rem 0.85rem 0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            {fresh && <div className="dot-new" style={{ width: 6, height: 6, borderRadius: '50%', background: col.color, flexShrink: 0 }} />}
            <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: '1rem', color: C.text1, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {o.name}
            </div>
          </div>
          <a href={`tel:${o.phone}`} style={{ fontFamily: MONO, fontSize: '0.72rem', color: C.text2, textDecoration: 'none', letterSpacing: '0.5px' }}>
            {o.phone}
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexShrink: 0, marginLeft: '0.75rem' }}>
          <span style={{ fontFamily: MONO, fontSize: '0.62rem', color: C.text3, paddingTop: '2px' }}>{timeAgo(o.created_at)}</span>
          <button onClick={() => onDel(o.id)}
            style={{ background: 'none', border: 'none', color: C.text3, fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: 0, fontFamily: FONT }}
            onMouseEnter={e => e.currentTarget.style.color = C.red}
            onMouseLeave={e => e.currentTarget.style.color = C.text3}>×</button>
        </div>
      </div>

      {/* Order text */}
      <div style={{ margin: '0 0.85rem 0.75rem', background: C.surface2, border: `1px solid ${C.border}`, padding: '0.6rem 0.75rem', borderRadius: '3px' }}>
        <div style={{ fontFamily: FONT, fontSize: '0.85rem', fontWeight: 700, color: C.text1, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{o.order_text}</div>
      </div>

      {/* Pickup date */}
      <div style={{ padding: '0 0.85rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: FONT, fontSize: '0.52rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.text3, marginBottom: '0.2rem' }}>Pickup</div>
          <div style={{ fontFamily: FONT, fontSize: '0.85rem', fontWeight: 800, color: col.color }}>{formatPickup(o.pickup)}</div>
        </div>
        {o.notes && (
          <div style={{ fontFamily: FONT, fontSize: '0.68rem', color: C.text2, fontStyle: 'italic', maxWidth: '55%', textAlign: 'right', lineHeight: 1.4 }}>{o.notes}</div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '1px', background: C.border }}>
        {allCols.filter(c => c.id !== col.id).map(c => (
          <button key={c.id} className="action-btn" onClick={() => onMove(o.id, c.id)}
            style={moveBtn(c)}
            onMouseEnter={e => { e.currentTarget.style.background = c.dim; e.currentTarget.style.color = c.color; e.currentTarget.style.borderColor = c.glow; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text2; e.currentTarget.style.borderColor = C.border; }}>
            {c.short}
          </button>
        ))}
        <button className="action-btn" onClick={() => onMove(o.id, archiveColId)}
          style={{ ...moveBtn(null), borderColor: C.border, color: C.text3 }}
          onMouseEnter={e => { e.currentTarget.style.background = C.emeraldDim; e.currentTarget.style.color = C.emerald; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}>
          DONE ✓
        </button>
      </div>
    </div>
  );
}

// ── DELIVERY CARD ──────────────────────────────────────────────────────────────
function DeliveryCard({ o, col, allCols, archiveColId, isMobile, onMove, onDel, expanded, onToggle, onDragStart, onTouchStart, onTouchMove, onTouchEnd }) {
  useTick(30000);
  const fresh = isNew(o.created_at);
  const suburb = [o.city, o.state_au].filter(Boolean).join(' ');

  const card = {
    background: C.surface,
    borderLeft: `3px solid ${col.color}`,
    borderRight: `1px solid ${C.border}`,
    borderTop: `1px solid ${C.border}`,
    borderBottom: `1px solid ${C.border}`,
    marginBottom: '0.5rem',
    userSelect: 'none',
    touchAction: 'none',
    overflow: 'hidden',
  };

  const moveBtn = (c) => ({
    flex: 1, height: 40,
    background: 'none',
    border: `1px solid ${C.border}`,
    color: C.text2,
    fontFamily: FONT, fontSize: '0.58rem', fontWeight: 800,
    letterSpacing: '1.5px', textTransform: 'uppercase',
    cursor: 'pointer', minWidth: 0,
  });

  return (
    <div
      className={`card-wrap card-anim${fresh ? ' card-new' : ''}`}
      draggable
      onDragStart={e => onDragStart(e, o.id)}
      onTouchStart={e => onTouchStart(e, o.id)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={card}>

      {/* Tap header */}
      <div onClick={onToggle} style={{ padding: '0.85rem 0.85rem 0.6rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
            {fresh && <div className="dot-new" style={{ width: 6, height: 6, borderRadius: '50%', background: col.color, flexShrink: 0 }} />}
            <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: '1rem', color: C.text1, lineHeight: 1.2 }}>{o.name}</div>
            {o.woo_order_number && (
              <span style={{ fontFamily: MONO, fontSize: '0.58rem', color: C.text3, background: C.surface2, padding: '0.1rem 0.4rem', border: `1px solid ${C.border}`, borderRadius: '3px' }}>
                #{o.woo_order_number}
              </span>
            )}
          </div>
          <a href={`tel:${o.phone}`} style={{ fontFamily: MONO, fontSize: '0.72rem', color: C.text2, textDecoration: 'none', letterSpacing: '0.5px' }}>
            {o.phone}
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flexShrink: 0, marginLeft: '0.75rem' }}>
          <span style={{ fontFamily: MONO, fontSize: '0.62rem', color: C.text3, paddingTop: '2px' }}>{timeAgo(o.created_at)}</span>
          <span style={{ color: C.text3, fontSize: '0.7rem', paddingTop: '3px', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
          <button onClick={e => { e.stopPropagation(); onDel(o.id); }}
            style={{ background: 'none', border: 'none', color: C.text3, fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = C.red}
            onMouseLeave={e => e.currentTarget.style.color = C.text3}>×</button>
        </div>
      </div>

      {/* Collapsed preview */}
      {!expanded && (
        <div style={{ padding: '0 0.85rem 0.75rem' }}>
          {suburb && <div style={{ fontFamily: FONT, fontSize: '0.72rem', color: C.text2, marginBottom: '0.2rem' }}>📍 {suburb}</div>}
          <div style={{ fontFamily: FONT, fontSize: '0.8rem', color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.order_text}</div>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 0.85rem 0.75rem' }}>
          <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderLeft: `2px solid ${col.color}`, padding: '0.65rem 0.75rem', marginBottom: '0.65rem', borderRadius: '3px' }}>
            <div style={{ fontFamily: FONT, fontSize: '0.52rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.text3, marginBottom: '0.35rem' }}>Delivery Address</div>
            {o.address_line1 && <div style={{ fontFamily: FONT, fontSize: '0.85rem', color: C.text1, lineHeight: 1.6, fontWeight: 600 }}>{o.address_line1}</div>}
            {o.address_line2 && <div style={{ fontFamily: FONT, fontSize: '0.85rem', color: C.text1, lineHeight: 1.6, fontWeight: 600 }}>{o.address_line2}</div>}
            {(o.city || o.state_au || o.postcode) && (
              <div style={{ fontFamily: FONT, fontSize: '0.85rem', color: C.text1, lineHeight: 1.6, fontWeight: 600 }}>
                {[o.city, o.state_au, o.postcode].filter(Boolean).join(' ')}
              </div>
            )}
          </div>
          <div style={{ marginBottom: '0.65rem' }}>
            <div style={{ fontFamily: FONT, fontSize: '0.52rem', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.text3, marginBottom: '0.35rem' }}>Order</div>
            <div style={{ fontFamily: FONT, fontSize: '0.88rem', fontWeight: 700, color: C.text1, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{o.order_text}</div>
          </div>
          {o.notes && (
            <div style={{ fontFamily: FONT, fontSize: '0.75rem', color: C.text2, fontStyle: 'italic', borderTop: `1px solid ${C.border}`, paddingTop: '0.4rem', marginBottom: '0.5rem', lineHeight: 1.5 }}>
              {o.notes}
            </div>
          )}
          <div style={{ fontFamily: MONO, fontSize: '0.6rem', color: C.text3 }}>{formatTime(o.created_at)}</div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '1px', background: C.border }}>
        {allCols.filter(c => c.id !== col.id).map(c => (
          <button key={c.id} className="action-btn" onClick={() => onMove(o.id, c.id)}
            style={moveBtn(c)}
            onMouseEnter={e => { e.currentTarget.style.background = c.dim; e.currentTarget.style.color = c.color; e.currentTarget.style.borderColor = c.glow; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text2; e.currentTarget.style.borderColor = C.border; }}>
            {c.short}
          </button>
        ))}
        <button className="action-btn" onClick={() => onMove(o.id, archiveColId)}
          style={{ ...moveBtn(null), color: C.text3 }}
          onMouseEnter={e => { e.currentTarget.style.background = C.emeraldDim; e.currentTarget.style.color = C.emerald; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}>
          DONE ✓
        </button>
      </div>
    </div>
  );
}

// ── ARCHIVE DROP ZONE ──────────────────────────────────────────────────────────
function ArchiveDrop({ colId, label, count, over, onDragOver, onDrop, onDragLeave, isMobile }) {
  return (
    <div
      data-col-id={colId}
      onDragOver={e => onDragOver(e, colId)}
      onDrop={e => onDrop(e, colId)}
      onDragLeave={onDragLeave}
      style={{
        border: `1px dashed ${over ? C.borderHover : C.border}`,
        background: over ? C.surface2 : 'transparent',
        minHeight: isMobile ? 80 : 340,
        display: 'flex', flexDirection: 'column',
        transition: 'all 0.15s',
      }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: FONT, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: over ? C.text2 : C.text3 }}>{label}</span>
        {count > 0 && <span style={{ fontFamily: MONO, fontSize: '0.7rem', color: C.text3 }}>{count}</span>}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', padding: '1.5rem' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke={over ? C.text2 : C.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
        <span style={{ fontFamily: FONT, fontSize: '0.6rem', color: over ? C.text2 : C.text3, letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.8 }}>
          {isMobile ? 'Tap DONE' : (over ? 'Release to archive' : 'Drag here\nwhen done')}
        </span>
      </div>
    </div>
  );
}

// ── BOARD SECTION ──────────────────────────────────────────────────────────────
function BoardSection({ title, accentColor, cols, archiveColId, archiveLabel, orders, isMobile, dragOver, onDragOver, onDrop, onDragLeave, onDragStart, onTouchStart, onTouchMove, onTouchEnd, onMove, onDel, expandedCards, onToggleExpand }) {
  const isDelivery    = archiveColId === 'delivered';
  const sectionOrders = orders.filter(o => cols.some(c => c.id === o.status));
  const archivedCount = orders.filter(o => o.status === archiveColId).length;
  const totalCols     = cols.length + 1;
  const gridCols      = isMobile ? '1fr' : `repeat(${totalCols}, minmax(230px, 1fr))`;

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      {/* Section label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem 1.25rem',
        borderBottom: `1px solid ${C.border}`,
        background: `linear-gradient(90deg, rgba(${accentColor === '#d97706' ? '217,119,6' : '37,99,235'},0.06) 0%, transparent 60%)`,
      }}>
        <div style={{ width: 2, height: 16, background: accentColor, borderRadius: '2px', flexShrink: 0 }} />
        <span style={{ fontFamily: FONT, fontSize: '0.6rem', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', color: accentColor }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ fontFamily: MONO, fontSize: '0.68rem', color: C.text3 }}>{sectionOrders.length} active</span>
      </div>

      {/* Columns grid */}
      <div style={{ overflowX: isMobile ? 'visible' : 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 0, minWidth: isMobile ? 'auto' : `${totalCols * 240}px`, borderBottom: `1px solid ${C.border}` }}>
          {cols.map(col => {
            const cards = sectionOrders.filter(o => o.status === col.id);
            const over  = dragOver === col.id;
            return (
              <div key={col.id} data-col-id={col.id}
                style={{
                  borderRight: `1px solid ${C.border}`,
                  background: over ? C.surface2 : C.bg,
                  minHeight: isMobile ? 'auto' : 420,
                  display: 'flex', flexDirection: 'column',
                  transition: 'background 0.15s',
                }}
                onDragOver={e => onDragOver(e, col.id)}
                onDrop={e => onDrop(e, col.id)}
                onDragLeave={onDragLeave}>
                <ColHeader col={col} count={cards.length} />
                <div style={{ padding: '0.6rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {cards.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '2rem' }}>
                      <span style={{ fontFamily: FONT, fontSize: '0.62rem', color: C.text3, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Empty</span>
                    </div>
                  )}
                  {cards.map(o => isDelivery ? (
                    <DeliveryCard key={o.id} o={o} col={col} allCols={cols} archiveColId={archiveColId}
                      isMobile={isMobile} onMove={onMove} onDel={onDel}
                      expanded={expandedCards.has(o.id)} onToggle={() => onToggleExpand(o.id)}
                      onDragStart={onDragStart} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
                  ) : (
                    <PickupCard key={o.id} o={o} col={col} allCols={cols} archiveColId={archiveColId}
                      isMobile={isMobile} onMove={onMove} onDel={onDel}
                      onDragStart={onDragStart} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
                  ))}
                </div>
              </div>
            );
          })}

          <ArchiveDrop colId={archiveColId} label={archiveLabel} count={archivedCount}
            over={dragOver === archiveColId} onDragOver={onDragOver} onDrop={onDrop} onDragLeave={onDragLeave} isMobile={isMobile} />
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App() {
  useGlobalStyles();

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
  const [refreshing, setRefreshing]       = useState(false);
  const [isMobile, setIsMobile]           = useState(window.innerWidth <= 768);
  const [expandedCards, setExpandedCards] = useState(new Set());
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
    setTimeout(() => setRefreshing(false), 500);
  }

  async function handlePinSubmit() {
    if (!pinInput.trim()) return;
    setPinLoading(true); setPinError('');
    const { ok } = await callAPI('/api/verify-pin', { method: 'POST', body: { pin: pinInput.trim() } });
    if (ok) { setPin(pinInput.trim()); setPinInput(''); }
    else setPinError('Incorrect PIN.');
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
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    callAPI('/api/update-order', { method: 'POST', body: { id, status: newStatus } }, pin);
  }

  async function del(id) {
    if (!window.confirm('Remove this order?')) return;
    setOrders(prev => prev.filter(o => o.id !== id));
    callAPI('/api/delete-order', { method: 'DELETE', body: { id } }, pin);
  }

  function toggleExpand(id) {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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

  const today = new Date().toISOString().split('T')[0];
  const m = isMobile;

  const inp = {
    display: 'block', width: '100%', height: m ? 44 : 50,
    border: `1.5px solid #ddd`, background: '#fff', color: '#0a0a0a',
    fontFamily: FONT, fontSize: '1rem', fontWeight: 600,
    padding: '0 0.85rem', boxSizing: 'border-box', outline: 'none',
    borderRadius: '3px', appearance: 'none', WebkitAppearance: 'none',
  };
  const lbl = {
    display: 'block', fontSize: '0.65rem', fontWeight: 800,
    letterSpacing: '1.5px', textTransform: 'uppercase',
    marginBottom: '0.4rem', color: '#555',
  };

  // ── PIN SCREEN ───────────────────────────────────────────────────────────────
  if (view === 'staff' && !pin) {
    return (
      <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Logo size={52} />
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '2.5rem 2rem' }}>
            <div style={{ fontFamily: FONT, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '3px', textTransform: 'uppercase', color: C.text2, marginBottom: '2rem', textAlign: 'center' }}>
              Staff Access
            </div>
            <label style={{ ...lbl, color: C.text2 }}>PIN</label>
            <input
              type="password" inputMode="numeric" maxLength={8} value={pinInput} placeholder="••••••••"
              onChange={e => { setPinInput(e.target.value); setPinError(''); }}
              onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
              style={{ ...inp, background: C.surface2, border: `1.5px solid ${C.border}`, color: C.text1, marginBottom: '1rem', height: 52, fontSize: '1.2rem', letterSpacing: '4px' }}
              autoFocus />
            {pinError && <div style={{ fontSize: '0.75rem', color: C.red, fontWeight: 700, marginBottom: '0.75rem' }}>{pinError}</div>}
            <button
              onClick={handlePinSubmit}
              disabled={pinLoading}
              style={{ display: 'block', width: '100%', height: 52, background: C.text1, color: C.bg, border: 'none', fontFamily: FONT, fontSize: '0.8rem', fontWeight: 900, letterSpacing: '2.5px', textTransform: 'uppercase', cursor: 'pointer', opacity: pinLoading ? 0.6 : 1 }}>
              {pinLoading ? 'Checking...' : 'Enter'}
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <span onClick={() => setView('customer')} style={{ fontFamily: FONT, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: C.text3, cursor: 'pointer' }}>
              ← Order Form
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── ARCHIVE VIEW ─────────────────────────────────────────────────────────────
  if (view === 'staff' && pin && archiveView) {
    const q = archiveSearch.toLowerCase().trim();
    const archived = orders
      .filter(o => ARCHIVE_STATUSES.has(o.status))
      .filter(o => !q || [o.name, o.phone, o.order_text, o.notes, o.pickup, o.city, o.state_au, o.woo_order_number].some(f => (f || '').toLowerCase().includes(q)))
      .sort((a, b) => b.created_at - a.created_at);

    return (
      <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', color: C.text1 }}>
        <Header orders={orders} onRefresh={handleRefresh} onLock={() => { setPin(''); setView('customer'); }}
          archiveView={archiveView} setArchiveView={setArchiveView} refreshing={refreshing} />
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '1.25rem' }}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <input type="text" placeholder="Search orders…" value={archiveSearch}
              onChange={e => setArchiveSearch(e.target.value)}
              style={{ display: 'block', width: '100%', height: 48, background: C.surface, border: `1px solid ${C.border}`, color: C.text1, fontFamily: FONT, fontSize: '0.9rem', padding: '0 2.5rem 0 1rem', boxSizing: 'border-box', outline: 'none', borderRadius: '4px' }} />
            {archiveSearch && (
              <button onClick={() => setArchiveSearch('')}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.text2, fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>
          <div style={{ fontFamily: FONT, fontSize: '0.6rem', color: C.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            {archived.length} order{archived.length !== 1 ? 's' : ''}
          </div>
          {archived.length === 0 && (
            <div style={{ textAlign: 'center', color: C.text3, fontSize: '0.75rem', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '4rem' }}>
              {q ? 'No results' : 'No archived orders'}
            </div>
          )}
          {archived.map(o => {
            const isDel  = o.status === 'delivered';
            const suburb = isDel ? [o.city, o.state_au].filter(Boolean).join(' ') : null;
            const typeColor = isDel ? C.blue : C.amber;
            return (
              <div key={o.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${typeColor}`, padding: '1rem 1.15rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 900, fontSize: '0.95rem', color: C.text1 }}>{o.name}</div>
                    <span style={{ fontFamily: MONO, fontSize: '0.7rem', color: C.text2 }}>{o.phone}</span>
                    <span style={{ fontFamily: FONT, fontSize: '0.52rem', fontWeight: 800, padding: '0.12rem 0.45rem', border: `1px solid ${typeColor}22`, color: typeColor, letterSpacing: '0.5px', textTransform: 'uppercase', borderRadius: '3px' }}>
                      {isDel ? 'Delivery' : 'Pickup'}
                    </span>
                    {isDel && o.woo_order_number && <span style={{ fontFamily: MONO, fontSize: '0.6rem', color: C.text3 }}>#{o.woo_order_number}</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: C.text2, marginBottom: '0.35rem', lineHeight: 1.4 }}>{o.order_text}</div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {isDel ? suburb && <span style={{ fontSize: '0.68rem', color: C.text3 }}>📍 {suburb}</span>
                            : <span style={{ fontSize: '0.68rem', color: C.text3 }}>Pickup: {formatPickup(o.pickup)}</span>}
                    <span style={{ fontFamily: MONO, fontSize: '0.65rem', color: C.text3 }}>{formatTime(o.created_at)}</span>
                  </div>
                  {o.notes && <div style={{ fontSize: '0.72rem', color: C.text3, fontStyle: 'italic', marginTop: '0.25rem' }}>{o.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <button className="action-btn" onClick={() => move(o.id, isDel ? 'del_received' : 'received')}
                    style={{ background: 'none', border: `1px solid ${C.border}`, color: C.text2, fontFamily: FONT, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '0.4rem 0.65rem', cursor: 'pointer', borderRadius: '3px' }}>
                    Restore
                  </button>
                  <button onClick={() => del(o.id)}
                    style={{ background: 'none', border: 'none', color: C.text3, fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1, padding: '0.4rem 0.25rem' }}
                    onMouseEnter={e => e.currentTarget.style.color = C.red}
                    onMouseLeave={e => e.currentTarget.style.color = C.text3}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── STAFF BOARD ──────────────────────────────────────────────────────────────
  if (view === 'staff' && pin) {
    const bp = {
      orders, isMobile, dragOver,
      onDragOver, onDrop, onDragLeave,
      onDragStart, onTouchStart, onTouchMove, onTouchEnd,
      onMove: move, onDel: del,
      expandedCards, onToggleExpand: toggleExpand,
    };
    return (
      <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh', color: C.text1 }}>
        <Header orders={orders} onRefresh={handleRefresh} onLock={() => { setPin(''); setView('customer'); }}
          archiveView={archiveView} setArchiveView={setArchiveView} refreshing={refreshing} />
        <BoardSection title="Pickup Orders"   accentColor="#d97706" cols={PICKUP_COLS} archiveColId="picked_up" archiveLabel="Picked Up" {...bp} />
        <BoardSection title="Delivery Orders" accentColor="#2563eb" cols={DEL_COLS}    archiveColId="delivered"  archiveLabel="Delivered"  {...bp} />
      </div>
    );
  }

  // ── SUCCESS ──────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ fontFamily: FONT, background: '#f8f8f8', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 440, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <img src={LOGO_URL} alt="Dry Age Biltong" style={{ height: m ? 44 : 80, width: 'auto' }} />
          </div>
          <div style={{ background: '#fff', border: '2px solid #0a0a0a', padding: m ? '1.5rem 1rem' : '3rem 2rem', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#fff', fontSize: '1.3rem' }}>✓</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.5rem', color: '#0a0a0a' }}>Order Placed</div>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              We've received your order and sent you a confirmation text. We'll SMS you when it's ready for pickup.
            </p>
            <button style={{ display: 'block', width: '100%', height: 52, background: '#0a0a0a', color: '#fff', border: 'none', fontFamily: FONT, fontSize: '0.8rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer' }}
              onClick={() => setSuccess(false)}>
              Place Another Order
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <span onClick={() => setView('staff')} style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#bbb', cursor: 'pointer' }}>
              Staff View
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── CUSTOMER FORM ────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: FONT, background: '#f8f8f8', minHeight: '100vh', padding: m ? '0.75rem' : '2rem 1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: m ? '0.75rem' : '1.75rem' }}>
          <img src={LOGO_URL} alt="Dry Age Biltong" style={{ height: m ? 44 : 80, width: 'auto' }} />
        </div>
        <div style={{ background: '#fff', border: '2px solid #0a0a0a', padding: m ? '1rem' : '2rem' }}>
          <div style={{ fontSize: m ? '1.1rem' : '1.4rem', fontWeight: 900, textTransform: 'uppercase', color: '#0a0a0a', marginBottom: m ? '0.25rem' : '0.25rem' }}>Place an Order</div>
          {!m && <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: '1.5rem' }}>Fresh pickup orders — Perth store only.</div>}
          {m && <div style={{ marginBottom: '0.75rem' }} />}

          <div style={{ marginBottom: m ? '0.75rem' : '1rem' }}>
            <label style={lbl}>Your Name</label>
            <input style={{ ...inp, borderColor: errors.name ? '#cc0000' : '#ddd' }} value={form.name} placeholder="Full name"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: m ? '0.75rem' : '1rem' }}>
            <label style={lbl}>Phone</label>
            <input style={{ ...inp, borderColor: errors.phone ? '#cc0000' : '#ddd' }} value={form.phone} placeholder="04XX XXX XXX" type="tel"
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            {!m && <div style={{ fontSize: '0.68rem', color: '#aaa', marginTop: '0.3rem' }}>We'll text you when your order is ready.</div>}
          </div>
          <div style={{ borderTop: '1px solid #eee', margin: m ? '0.75rem 0' : '1.25rem 0' }} />
          <div style={{ marginBottom: m ? '0.75rem' : '1rem' }}>
            <label style={lbl}>What would you like?</label>
            {!m && <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '0.4rem' }}>Include quantity in kg.</div>}
            <textarea style={{ ...inp, height: 'auto', minHeight: m ? 70 : 100, padding: '0.65rem 0.85rem', resize: 'vertical', borderColor: errors.order_text ? '#cc0000' : '#ddd' }}
              value={form.order_text}
              placeholder="e.g. 2kg boerewors, 1kg biltong (sliced thin)"
              onChange={e => setForm(f => ({ ...f, order_text: e.target.value }))} />
            {errors.order_text && <div style={{ fontSize: '0.7rem', color: '#cc0000', marginTop: '0.25rem', fontWeight: 700 }}>Please tell us what you would like.</div>}
          </div>
          <div style={{ borderTop: '1px solid #eee', margin: m ? '0.75rem 0' : '1.25rem 0' }} />
          <div style={{ marginBottom: m ? '0.75rem' : '1rem' }}>
            <label style={lbl}>Pickup Date</label>
            <input type="date" style={{ ...inp, borderColor: errors.pickup ? '#cc0000' : '#ddd' }} value={form.pickup} min={today}
              onChange={e => setForm(f => ({ ...f, pickup: e.target.value }))} />
          </div>
          <div style={{ marginBottom: m ? '0.75rem' : '1.5rem' }}>
            <label style={lbl}>Notes (optional)</label>
            <textarea style={{ ...inp, height: 'auto', minHeight: m ? 50 : 80, padding: '0.65rem 0.85rem', resize: 'vertical' }}
              value={form.notes} placeholder="Any special requests..."
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {Object.keys(errors).filter(k => k !== 'order_text').length > 0 && (
            <div style={{ fontSize: '0.72rem', color: '#cc0000', fontWeight: 700, marginBottom: '0.75rem' }}>Please fill in all required fields.</div>
          )}

          <button style={{ display: 'block', width: '100%', height: m ? 48 : 54, background: '#0a0a0a', color: '#fff', border: 'none', fontFamily: FONT, fontSize: m ? '0.82rem' : '0.85rem', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
            onClick={submit} disabled={submitting}>
            {submitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: m ? '0.75rem' : '1.5rem', paddingBottom: '1rem' }}>
          <span onClick={() => setView('staff')} style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: '#bbb', cursor: 'pointer', userSelect: 'none' }}>
            Staff View
          </span>
        </div>
      </div>
    </div>
  );
}
