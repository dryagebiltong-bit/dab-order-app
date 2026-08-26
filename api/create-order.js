import { supabase } from './_db.js';
import { sendSMS, notifyStaff } from './_sms.js';
import { authorized } from './_auth.js';
import { perthDateISO, fmtWhen } from './_when.js';

const SHOP = 'Dry Age Biltong';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Staff calls carry the PIN header. Customers (the public order form) do not.
  // That distinction is what lets staff take a same-day order over the phone
  // while customers are held to the next-day minimum.
  const isStaff = authorized(req);

  const b = req.body || {};
  const isDelivery = b.order_type === 'hand_delivery';

  const name       = (b.name       || '').trim();
  const phone      = (b.phone      || '').trim();
  const orderText  = (b.order_text || '').trim();
  const when       = (b.pickup     || '').trim();          // YYYY-MM-DD
  const time       = (b.pickup_time|| '').trim();          // '14:30' | 'anytime' | ''
  const notes      = (b.notes      || '').trim();

  if (!name || !phone || !orderText || !when) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const addr = {
    line1:    (b.address_line1 || '').trim(),
    line2:    (b.address_line2 || '').trim(),
    city:     (b.city          || '').trim(),
    state:    (b.state_au      || 'WA').trim(),
    postcode: (b.postcode      || '').trim(),
  };

  if (isDelivery && (!addr.line1 || !addr.city)) {
    return res.status(400).json({ error: 'Delivery orders need a street address and suburb' });
  }

  // Next-day minimum for customers. Enforced here as well as in the date picker,
  // because a `min` attribute on an <input type="date"> is only a UI hint and is
  // trivial to bypass. Staff are exempt.
  if (!isStaff && when < perthDateISO(1)) {
    return res.status(400).json({
      error: 'Orders need at least one day’s notice. Please choose tomorrow or later.',
      code:  'TOO_SOON',
    });
  }

  const order = {
    id:          `${isDelivery ? 'hd' : 'dab'}_${Date.now()}`,
    name,
    phone,
    order_text:  orderText,
    pickup:      when,
    pickup_time: time || null,
    notes,
    status:      isDelivery ? 'hd_received' : 'received',
    order_type:  isDelivery ? 'hand_delivery' : 'pickup',
    created_at:  Date.now(),
  };

  if (isDelivery) {
    order.address_line1 = addr.line1;
    order.address_line2 = addr.line2;
    order.city          = addr.city;
    order.state_au      = addr.state;
    order.postcode      = addr.postcode;
  }

  const { error } = await supabase.from('orders').insert(order);
  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({ error: 'Could not save order' });
  }

  const whenText = fmtWhen(when, time);

  // Confirmation to the customer
  try {
    await sendSMS(
      phone,
      isDelivery
        ? `Hi ${name}, thanks for your order at ${SHOP}! We have it and will deliver on ${whenText}. We'll text you when it's on its way.`
        : `Hi ${name}, thanks for your order at ${SHOP}! We have it and will have everything ready for pickup on ${whenText}. We'll text you when it's ready.`
    );
  } catch (e) {
    console.error('SMS error:', e.message);
  }

  // Heads-up to staff
  try {
    const where = isDelivery
      ? `\nDeliver to: ${[addr.line1, addr.line2, [addr.city, addr.state, addr.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}`
      : '';
    await notifyStaff(
      `${isDelivery ? '🚚 New delivery order' : '🛍️ New pickup order'} at ${SHOP}\n\n` +
      `Customer: ${name}\nPhone: ${phone}\nOrder: ${orderText}\n` +
      `${isDelivery ? 'Delivery' : 'Pickup'}: ${whenText}${where}` +
      `${notes ? `\nNotes: ${notes}` : ''}` +
      `${isStaff ? '\n\n(Entered manually by staff)' : ''}`
    );
  } catch (e) {
    console.error('Staff notify error:', e.message);
  }

  return res.status(200).json({ success: true, id: order.id });
}
