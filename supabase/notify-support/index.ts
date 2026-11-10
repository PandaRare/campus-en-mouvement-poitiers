// Edge Function « notify-support » : envoie un e-mail à la modération à chaque nouvelle ligne
// de support_requests (Database Webhook, événement INSERT).
// Secrets requis : RESEND_API_KEY, SUPPORT_TO (votre adresse de réception), WEBHOOK_SECRET
// Option : SUPPORT_FROM (par défaut « Campus en Mouvement <onboarding@resend.dev> »)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function secretMatches(received: string | null): boolean {
  const expected = Deno.env.get('WEBHOOK_SECRET') ?? ''
  if (!received || !expected || received.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= received.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

Deno.serve(async (req) => {
  if (!secretMatches(req.headers.get('x-webhook-secret'))) return json({ error: 'Unauthorized' }, 401)

  const payload = await req.json().catch(() => null)
  const row = payload?.record
  if (payload?.type !== 'INSERT' || !row) return json({ skipped: true })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('SUPPORT_FROM') ?? 'Campus en Mouvement <onboarding@resend.dev>',
      to: [Deno.env.get('SUPPORT_TO')],
      subject: `[Campus] ${row.category} — nouvelle demande`,
      html: `<p><b>Motif :</b> ${escapeHtml(row.category)}</p>
<p><b>Message :</b><br>${escapeHtml(row.message).replace(/\n/g, '<br>')}</p>
<p><b>Membre :</b> ${escapeHtml(row.user_id)}<br><b>Trajet :</b> ${escapeHtml(row.ride_id ?? '—')}</p>`,
    }),
  })

  return res.ok ? json({ sent: true }) : json({ error: await res.text() }, 502)
})
