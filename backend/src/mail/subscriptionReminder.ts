import { Resend } from 'resend'
import { env, isResendConfigured, shouldFallbackMailToConsole } from '../env.js'

export interface SubscriptionReminderEmailPayload {
  to: string
  billingOwnerName: string
  organizationName: string
  subscriptionStatus: string
  planCode: string | null
  periodEnd: Date | null
  daysRemaining: number | null
  cycleLengthDays: number | null
  payUrl: string | null
}

export type SubscriptionReminderDeliveryResult =
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

function formatDisplayDate(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function buildReminderHtml(payload: SubscriptionReminderEmailPayload): string {
  const name = escapeHtml(payload.billingOwnerName)
  const orgName = escapeHtml(payload.organizationName)
  const status = escapeHtml(payload.subscriptionStatus)
  const plan = escapeHtml(payload.planCode ?? 'Corporate')
  const periodEnd = escapeHtml(formatDisplayDate(payload.periodEnd))
  const daysLeft =
    payload.daysRemaining !== null
      ? `${payload.daysRemaining} day${payload.daysRemaining === 1 ? '' : 's'}`
      : '—'
  const cycle =
    payload.cycleLengthDays !== null
      ? `${Math.round(payload.cycleLengthDays)} days`
      : '—'
  const payBlock = payload.payUrl
    ? `<p style="margin:24px 0;">
        <a href="${escapeHtml(payload.payUrl)}" style="display:inline-block;background:${BRAND.blue};color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">
          Pay subscription in DirectPay
        </a>
      </p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Subscription reminder</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:8px;border:1px solid ${BRAND.border};">
        <tr><td style="background:${BRAND.navy};padding:24px 28px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:20px;">APS Wallet BI — subscription reminder</h1>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 16px;">Hello ${name},</p>
          <p style="margin:0 0 16px;color:${BRAND.muted};">
            This is your daily reminder for <strong style="color:${BRAND.text};">${orgName}</strong>.
            Your billing period is shorter than one month, so we send this notice each day until the period ends or the subscription is renewed.
          </p>
          <table role="presentation" width="100%" style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:6px;margin:16px 0;">
            <tr><td style="padding:16px;font-size:14px;line-height:1.6;">
              <div><strong>Status:</strong> ${status}</div>
              <div><strong>Plan:</strong> ${plan}</div>
              <div><strong>Billing cycle:</strong> ${cycle}</div>
              <div><strong>Period ends:</strong> ${periodEnd}</div>
              <div><strong>Time remaining:</strong> ${escapeHtml(daysLeft)}</div>
            </td></tr>
          </table>
          ${payBlock}
          <p style="margin:0;font-size:13px;color:${BRAND.muted};">
            You can also sign in to DirectPay with this billing email and open <strong>Billing → Subscription invoices</strong>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function logReminderToConsole(payload: SubscriptionReminderEmailPayload) {
  console.log('[subscription-reminder] Email delivery fallback:', {
    to: payload.to,
    organization: payload.organizationName,
    status: payload.subscriptionStatus,
    periodEnd: payload.periodEnd?.toISOString() ?? null,
    payUrl: payload.payUrl,
  })
}

export async function sendSubscriptionReminderEmail(
  payload: SubscriptionReminderEmailPayload,
): Promise<SubscriptionReminderDeliveryResult> {
  if (!isResendConfigured()) {
    if (shouldFallbackMailToConsole()) {
      logReminderToConsole(payload)
      return {
        ok: true,
        channel: 'console',
        warning: 'Resend is not configured. Reminder logged to server console.',
      }
    }
    return { ok: false, message: 'Email is not configured (RESEND_API_KEY / RESEND_FROM)' }
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY!)
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM!,
      to: payload.to,
      subject: `Subscription reminder — ${payload.organizationName}`,
      html: buildReminderHtml(payload),
    })
    if (error) {
      if (shouldFallbackMailToConsole()) {
        logReminderToConsole(payload)
        return {
          ok: true,
          channel: 'console',
          warning: error.message ?? 'Resend rejected the email; logged to console.',
        }
      }
      return { ok: false, message: error.message ?? 'Resend rejected the email request' }
    }
    return { ok: true, channel: 'resend' }
  } catch (err) {
    if (shouldFallbackMailToConsole()) {
      logReminderToConsole(payload)
      return {
        ok: true,
        channel: 'console',
        warning: err instanceof Error ? err.message : 'Send failed; logged to console.',
      }
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to send subscription reminder email',
    }
  }
}
