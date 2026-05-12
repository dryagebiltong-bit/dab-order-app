import { supabase } from './_db.js';
import { authorized } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) return res.status(500).json({ error: 'Could not delete order' });

  return res.status(200).json({ success: true });
}
