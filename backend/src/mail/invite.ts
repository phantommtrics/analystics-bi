import { Resend } from 'resend'
import { env, isResendConfigured, shouldFallbackMailToConsole } from '../env.js'

export interface InviteEmailPayload {
  to: string
  username: string
  email: string
  temporaryPassword: string
  roleNames: string[]
  groupNames: string[]
}

export type InviteDeliveryResult =
  | { ok: true; channel: 'resend' }
  | { ok: true; channel: 'console'; warning: string }
  | { ok: false; message: string }

const BRAND = {
  navy: '#0f1a2e',
  gold: '#c9a227',
  blue: '#2f5fd0',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#e5e7eb',
  surface: '#f8fafc',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildInviteHtml(payload: InviteEmailPayload): string {
  const loginUrl = `${env.APP_PUBLIC_URL}/login`
  const username = escapeHtml(payload.username)
  const email = escapeHtml(payload.email)
  const password = escapeHtml(payload.temporaryPassword)
  const roles =
    payload.roleNames.length > 0
      ? payload.roleNames.map(escapeHtml).join(', ')
      : 'None assigned'
  const groups =
    payload.groupNames.length > 0
      ? payload.groupNames.map(escapeHtml).join(', ')
      : 'None assigned'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PrixBI Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#eef2f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};box-shadow:0 8px 24px rgba(15,26,46,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg, ${BRAND.navy} 0%, #1a3358 100%);padding:28px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display:inline-block;min-width:40px;height:40px;line-height:40px;padding:0 8px;text-align:center;border-radius:8px;background-color:${BRAND.gold};color:${BRAND.navy};font-size:15px;font-weight:700;">Px</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:16px;">
                    <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.72);">PrixBI</p>
                    <h1 style="margin:8px 0 0;font-size:24px;line-height:1.3;font-weight:600;color:#ffffff;">You're invited</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.text};">
                Your operator account is ready. Sign in with the credentials below, then set a new password when prompted.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:8px;margin:0 0 24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.muted};">Sign-in details</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;line-height:1.8;">
                      <tr>
                        <td style="width:130px;padding:4px 0;color:${BRAND.muted};vertical-align:top;">Username</td>
                        <td style="padding:4px 0;color:${BRAND.text};font-weight:500;">${username}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:${BRAND.muted};vertical-align:top;">Email</td>
                        <td style="padding:4px 0;color:${BRAND.text};font-weight:500;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:${BRAND.muted};vertical-align:top;">Temporary password</td>
                        <td style="padding:4px 0;">
                          <code style="display:inline-block;padding:6px 10px;background-color:#ffffff;border:1px solid ${BRAND.border};border-radius:6px;font-size:14px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:${BRAND.navy};letter-spacing:0.04em;">${password}</code>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;">
                <tr>
                  <td style="padding-bottom:12px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.muted};">Access</p>
                    <p style="margin:0;font-size:14px;line-height:1.6;"><strong style="color:${BRAND.text};">Role sets:</strong> ${roles}</p>
                    <p style="margin:6px 0 0;font-size:14px;line-height:1.6;"><strong style="color:${BRAND.text};">Groups:</strong> ${groups}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px;background-color:${BRAND.blue};">
                    <a href="${loginUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Sign in to PrixBI</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;padding:14px 16px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;line-height:1.5;color:#92400e;">
                For security, you must change this temporary password on your first login.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:${BRAND.surface};border-top:1px solid ${BRAND.border};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted};text-align:center;">
                If you did not expect this invitation, contact your system administrator.<br />
                &copy; PrixBI
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function logInviteToConsole(payload: InviteEmailPayload) {
  console.log('[invite] Email delivery fallback — credentials logged below:')
  console.log({
    to: payload.to,
    username: payload.username,
    temporaryPassword: payload.temporaryPassword,
    roles: payload.roleNames,
    groups: payload.groupNames,
    loginUrl: `${env.APP_PUBLIC_URL}/login`,
  })
}

function isLikelyConnectivityError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)

  const lower = message.toLowerCase()
  return (
    lower.includes('could not be resolved') ||
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('timeout') ||
    lower.includes('unable to fetch')
  )
}

function formatResendError(error: { message?: string; name?: string }): string {
  const base = error.message ?? 'Resend rejected the email request'
  if (base.toLowerCase().includes('could not be resolved')) {
    return 'Could not reach Resend (network/DNS). Check internet access, firewall, and RESEND_API_KEY.'
  }
  return base
}

function consoleFallbackWarning(): string {
  return 'Resend could not deliver the email. Temporary password was written to the API server console.'
}

export async function sendInviteEmail(payload: InviteEmailPayload): Promise<InviteDeliveryResult> {
  if (!isResendConfigured()) {
    logInviteToConsole(payload)
    return {
      ok: true,
      channel: 'console',
      warning: 'Resend is not configured (RESEND_API_KEY / RESEND_FROM). Credentials logged to the server console.',
    }
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY!)
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM!,
      to: payload.to,
      subject: 'Your PrixBI account invitation',
      html: buildInviteHtml(payload),
    })

    if (error) {
      console.error('[invite] Resend API error:', error)
      if (shouldFallbackMailToConsole() && isLikelyConnectivityError(error)) {
        logInviteToConsole(payload)
        return { ok: true, channel: 'console', warning: consoleFallbackWarning() }
      }
      return { ok: false, message: formatResendError(error) }
    }

    return { ok: true, channel: 'resend' }
  } catch (err) {
    console.error('[invite] Resend request failed:', err)
    if (shouldFallbackMailToConsole() && isLikelyConnectivityError(err)) {
      logInviteToConsole(payload)
      return { ok: true, channel: 'console', warning: consoleFallbackWarning() }
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to send invitation email',
    }
  }
}
