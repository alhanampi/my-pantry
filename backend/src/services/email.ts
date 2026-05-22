import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM ?? 'My Pantry <noreply@mypantry.app>'

export async function sendLinkInvitation(params: {
  to: string
  senderUsername: string
  token: string
  appUrl: string
}): Promise<void> {
  const { to, senderUsername, token, appUrl } = params
  const confirmUrl = `${appUrl}/?invite=${token}`

  if (!resend) {
    console.log(`[email] invite → ${to} from @${senderUsername}`)
    console.log(`[email] confirm URL: ${confirmUrl}`)
    return
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `@${senderUsername} wants to share their pantry with you`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="margin-top:0">Pantry sharing invitation</h2>
  <p><strong>@${senderUsername}</strong> has invited you to share their pantry on My Pantry.</p>
  <p>Once you accept, you'll both see and edit the same pantry and shopping list.</p>
  <a href="${confirmUrl}"
     style="display:inline-block;margin:20px 0;padding:12px 28px;background:#2e7d32;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
    Accept invitation
  </a>
  <p style="color:#666;font-size:13px;margin-top:24px">
    This link expires in 48 hours.<br>
    If you weren't expecting this, you can safely ignore this email.
  </p>
</body>
</html>`.trim(),
  })
}
