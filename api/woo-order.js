import { supabase } from './_db.js';
import { sendSMS } from './_sms.js';

const SHOP = 'Dry Age Biltong';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const woo = req.body;

  // Return 200 for test pings (no order id)
  if (!woo || !woo.id) return res.status(200).json({ skipped: 'Test ping received' });

  // Only process Standard Shipping (delivery) orders
  const shippingMethod = (woo.shipping_lines?.[0]?.method_title || '').toLowerCase();
  if (!shippingMethod.includes('standard')) {
    return res.status(200).json({ skipped: 'Not a standard shipping order' });
  }

  // Prevent duplicate imports
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('woo_order_id', String(woo.id))
    .maybeSingle();

  if (existing) return res.status(200).json({ skipped: 'Already imported' });

  const billing  = woo.billing  || {};
  const shipping = woo.shipping || {};

  // Use shipping address for delivery, fall back to billing
  const addr = {
    line1:   shipping.address_1 || billing.address_1 || '',
    line2:   shipping.address_2 || billing.address_2 || '',
    city:    shipping.city      || billing.city      || '',
    state:   shipping.state     || billing.state     || '',
    postcode: shipping.postcode || billing.postcode  || '',
  };

  const name  = [billing.first_name, billing.last_name].filter(Boolean).join(' ').trim() || 'Customer';
  const phone = billing.phone || '';

  const orderText = (woo.line_items || [])
    .map(item => {
      const qty  = item.quantity > 1 ? ` x${item.quantity}` : '';
      const meta = (item.meta_data || [])
        .filter(m => !String(m.key).startsWith('_'))
        .map(m => m.value)
        .join(', ');
      return meta ? `${item.name}${qty} (${meta})` : `${item.name}${qty}`;
    })
    .join('\n') || 'See WooCommerce order';

  const order = {
    id:               `woo_${woo.id}_${Date.now()}`,
    name,
    phone,
    order_text:       orderText,
    notes:            woo.customer_note || '',
    status:           'del_received',
    order_type:       'delivery',
    address_line1:    addr.line1,
    address_line2:    addr.line2,
    city:             addr.city,
    state_au:         addr.state,
    postcode:         addr.postcode,
    woo_order_id:     String(woo.id),
    woo_order_number: String(woo.number || woo.id),
    created_at:       Date.now(),
  };

  const { error } = await supabase.from('orders').insert(order);
  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({ error: 'Could not save order' });
  }

  if (phone) {
    try {
      await sendSMS(
        phone,
        `Hi ${name}, thanks for your order at ${SHOP}! We have received it and will have it packed and shipped for you. We will text you once it is on its way.`
      );
    } catch (e) {
      console.error('SMS error:', e.message);
    }
  }

  return res.status(200).json({ success: true, orderId: order.id });
}
