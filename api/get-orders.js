import { supabase } from './_db.js';
import { authorized } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: 'Could not fetch orders' });

  return res.status(200).json({ orders: data });
}
