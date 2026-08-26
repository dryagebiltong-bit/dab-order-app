import { supabase } from './_db.js';
import { authorized } from './_auth.js';
import { sendSMS } from './_sms.js';
import { fmtWhen } from './_when.js';

const SHOP = 'Dry Age Biltong';

// Which section an order belongs to, decided by status. Status is always set,
// including on older rows created before order_type existed, so this is the
// reliable way to classify an order.
function sectionOf(status) {
  if (['del_received', 'del_preparing', 'shipped'].includes(status)) return 'website';
  if (['hd_received', 'hd_preparing', 'hd_out', 'hd_delivered'].includes(status)) return 'deliver';
  return 'pickup';
}

const VALID = new Set([
  'received', 'preparing', 'ready', 'picked_up',
  'del_received', 'del_preparing', 'shipped',
  'hd_received', 'hd_preparing', 'hd_out', 'hd_delivered',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { id, status, tracking_number, pickup, pickup_time, notify } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing order id' });

  const changingStatus   = typeof status === 'string' && status.length > 0;
  const changingSchedule = pickup !== undefined || pickup_time !== undefined;

  if (!changingStatus && !changingSchedule) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
  if (changingStatus && !VALID.has(status)) {
    return res.status(400).json({ error: 'Unknown status' });
  }

  const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const updates = {};
  if (changingStatus && order.status !== status) updates.status = status;
  if (tracking_number) updates.tracking_number = tracking_number;
  if (pickup !== undefined)      updates.pickup      = pickup || null;
  if (pickup_time !== undefined) updates.pickup_time = pickup_time || null;

  if (!Object.keys(updates).length) return res.status(200).json({ success: true });

  const { error } = await supabase.from('orders').update(updates).eq('id', id);
  if (error) {
    console.error('Supabase update error:', error);
    return res.status(500).json({ error: 'Could not update order' });
  }

  // ── Customer notifications ────────────────────────────────────────────────
  // Each is wrapped separately so a failed text never fails the status change —
  // the board must stay in step with reality even if Twilio is down.

  // Pickup order is ready to collect
  if (updates.status === 'ready') {
    try {
      await sendSMS(order.phone, `Hi ${order.name}, your order at ${SHOP} is ready for pickup! See you soon.`);
    } catch (e) { console.error('SMS error:', e.message); }
  }

  // Hand-delivery order has left the shop
  if (updates.status === 'hd_out') {
    try {
      await sendSMS(order.phone, `Hi ${order.name}, your order from ${SHOP} is on its way to you now. See you shortly!`);
    } catch (e) { console.error('SMS error:', e.message); }
  }

  // Website order posted — send the AusPost tracking link
  if (updates.status === 'shipped' && tracking_number) {
    try {
      await sendSMS(
        order.phone,
        `Hi ${order.name}, your ${SHOP} order has been shipped! Track your parcel here: https://auspost.com.au/mypost/track/#/details/${tracking_number}`
      );
    } catch (e) { console.error('SMS error:', e.message); }
  }

  // Date or time moved — only texts when staff ticked the box
  if (changingSchedule && notify) {
    const newDate = pickup !== undefined ? pickup : order.pickup;
    const newTime = pickup_time !== undefined ? pickup_time : order.pickup_time;
    const isDelivery = sectionOf(order.status) === 'deliver';
    const firstName = String(order.name || '').split(' ')[0] || 'there';

    try {
      await sendSMS(
        order.phone,
        `Hi ${firstName}, your order at ${SHOP} has been rescheduled. ` +
        `Your new ${isDelivery ? 'delivery' : 'pickup'} is ${fmtWhen(newDate, newTime)}. ` +
        `Sorry for any inconvenience, see you then!`
      );
    } catch (e) { console.error('SMS error:', e.message); }
  }

  return res.status(200).json({ success: true });
}
