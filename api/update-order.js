import { supabase } from './_db.js';
import { authorized } from './_auth.js';
import { sendSMS } from './_sms.js';

const SHOP = 'Dry Age Biltong';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { id, status, tracking_number } = req.body || {};
  if (!id || !status) return res.status(400).json({ error: 'Missing fields' });

  const { data: order } = await supabase
    .from('orders').select('*').eq('id', id).single();

  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status === status) return res.status(200).json({ success: true });

  const updates = { status };
  if (tracking_number) updates.tracking_number = tracking_number;

  const { error } = await supabase
    .from('orders').update(updates).eq('id', id);

  if (error) return res.status(500).json({ error: 'Could not update order' });

  // SMS: pickup order ready for collection
  if (status === 'ready') {
    try {
      await sendSMS(
        order.phone,
        `Hi ${order.name}, your order at ${SHOP} is ready for pickup! See you soon.`
      );
    } catch (e) {
      console.error('SMS error:', e.message);
    }
  }

  // SMS: delivery order shipped — send AusPost tracking link to customer
  if (status === 'shipped' && tracking_number) {
    try {
      await sendSMS(
        order.phone,
        `Hi ${order.name}, your ${SHOP} order has been shipped! Track your parcel here: https://auspost.com.au/mypost/track/#/details/${tracking_number}`
      );
    } catch (e) {
      console.error('SMS error:', e.message);
    }
  }

  return res.status(200).json({ success: true });
}
