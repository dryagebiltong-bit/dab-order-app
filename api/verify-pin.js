export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pin } = req.body || {};

  if (!pin || pin !== process.env.STAFF_PIN) {
    return res.status(401).json({ error: 'Incorrect PIN' });
  }

  return res.status(200).json({ success: true });
}
