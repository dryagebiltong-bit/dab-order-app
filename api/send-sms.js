export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { to, message } = req.body;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    return res.status(500).json({ error: 'Twilio env vars not set' });
  }

  // Format Australian number to E.164 (+61XXXXXXXXX)
  const digits = to.replace(/\D/g, '');
  const e164 = digits.startsWith('61')
    ? `+${digits}`
    : `+61${digits.startsWith('0') ? digits.slice(1) : digits}`;

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: e164, From: from, Body: message }),
      }
    );

    const data = await response.json();
    if (response.ok) return res.status(200).json({ success: true, sid: data.sid });
    return res.status(500).json({ error: data.message });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
