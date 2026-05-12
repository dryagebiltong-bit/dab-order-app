import { supabase } from './_db.js';
import { sendSMS } from './_sms.js';

const SHOP = 'Dry Age Biltong';

function formatPickup(d) {
  if (!d) return d;
  const [y, m, day] = d.split('-');
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, phone, order_text, pickup, notes } = req.body || {};

  if (!name?.trim() || !phone?.trim() || !order_text?.trim() || !pickup) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const order = {
    id:         `dab_${Date.now()}`,
    name:       name.trim(),
    phone:      phone.trim(),
    order_text: order_text.trim(),
    pickup,
    notes:      (notes || '').trim(),
    status:     'received',
    created_at: Date.now(),
  };

  const { error } = await supabase.from('orders').insert(order);
  if (error) return res.status(500).json({ error: 'Could not save order' });

  try {
    await sendSMS(
      order.phone,
      `Hi ${order.name}, thanks for your order at ${SHOP}! We have it and will have everything ready for pickup on ${formatPickup(order.pickup)}. We'll text you when it's ready.`
    );
  } catch (e) {
    console.error('SMS error:', e.message);
  }

  return res.status(200).json({ success: true });
}
