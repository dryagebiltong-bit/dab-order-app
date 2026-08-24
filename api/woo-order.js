import { supabase } from './_db.js';
import { sendSMS, notifyStaff } from './_sms.js';

const SHOP = 'Dry Age Biltong';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const topic = req.headers['x-wc-webhook-topic'];
  if (topic && topic !== 'order.created') {
    return res.status(200).json({ skipped: 'Not an order.created event' });
  }

  const woo = req.body;
  if (!woo || !woo.id) return res.status(200).json({ skipped: 'Test ping received' });

  // Only skip orders that are genuinely Local Pickup (handled separately, manually,
  // via the in-app "New Order" form). Every other shipping method — Standard,
  // Weight Based, Express, or anything added in future — is treated as a delivery
  // order. Previously this only allowed methods whose title contained the word
  // "standard", which silently dropped any other delivery method (e.g. "Weight
  // Based Shipping") with no error and no record anywhere.
  const shippingLine  = woo.shipping_lines?.[0] || {};
  const methodId      = String(shippingLine.method_id || '').toLowerCase();
  const methodTitle   = String(shippingLine.method_title || '').toLowerCase();
  const isLocalPickup = methodId.includes('pickup') || methodTitle.includes('pickup') || methodTitle.includes('collect');

  if (isLocalPickup) {
    return res.status(200).json({ skipped: 'Local pickup order (handled separately)' });
  }

  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('woo_order_id', String(woo.id))
    .maybeSingle();

  if (existing) return res.status(200).json({ skipped: 'Already imported' });

  const billing  = woo.billing  || {};
  const shipping = woo.shipping || {};

  const addr = {
    line1:    shipping.address_1 || billing.address_1 || '',
    line2:    shipping.address_2 || billing.address_2 || '',
    city:     shipping.city      || billing.city      || '',
    state:    shipping.state     || billing.state     || '',
    postcode: shipping.postcode  || billing.postcode  || '',
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
    // Safety net: if the order can't be auto-saved for any reason, still get a
    // text so this never fails completely silently again.
    try {
      await notifyStaff(
        `⚠️ New WooCommerce order #${order.woo_order_number} came in but could NOT be saved automatically. Please check WooCommerce and add it to the app manually.\n\nCustomer: ${name}\nPhone: ${phone}`
      );
    } catch (e) {
      console.error('Staff alert error:', e.message);
    }
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

  try {
    const suburb = [addr.city, addr.state].filter(Boolean).join(' ');
    await notifyStaff(
      `🚚 New delivery order at ${SHOP}\n\nOrder #${order.woo_order_number}\nCustomer: ${name}\nPhone: ${phone}\nOrder: ${orderText}\nDeliver to: ${[addr.line1, suburb, addr.postcode].filter(Boolean).join(', ')}${order.notes ? `\nNotes: ${order.notes}` : ''}`
    );
  } catch (e) {
    console.error('Staff notify error:', e.message);
  }

  return res.status(200).json({ success: true, orderId: order.id });
}
