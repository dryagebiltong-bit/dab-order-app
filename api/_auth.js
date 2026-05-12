export function authorized(req) {
  const pin = req.headers['x-staff-pin'];
  return pin && pin === process.env.STAFF_PIN;
}
