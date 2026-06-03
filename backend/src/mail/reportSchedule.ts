import { Resend } from 'resend'
import { env, isResendConfigured, shouldFallbackMailToConsole } from '../env.js'

export type ReportScheduleAttachment = {
  filename: string
  content: Buffer
}

export interface ReportScheduleEmailPayload {
  to: string
  reportName: string
  groupName: string
  scheduledAt: Date
  reportUrl: string
  filterLabel?: string
  attachments?: ReportScheduleAttachment[]
}

export type ReportScheduleDeliveryResult =
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

function formatScheduledAt(date: Date): string {
  return date.toLocaleString('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'UTC',
  })
}

function buildReportScheduleHtml(payload: ReportScheduleEmailPayload): string {
  const reportName = escapeHtml(payload.reportName)
  const groupName = escapeHtml(payload.groupName)
  const when = escapeHtml(formatScheduledAt(payload.scheduledAt))
  const reportUrl = escapeHtml(payload.reportUrl)
  const filterLabel = payload.filterLabel
    ? escapeHtml(payload.filterLabel)
    : null
  const hasAttachments = (payload.attachments?.length ?? 0) > 0

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Scheduled report ready</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#eef2f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};box-shadow:0 8px 24px rgba(15,26,46,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg, ${BRAND.navy} 0%, #1a3358 100%);padding:28px 32px;">
              <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.72);">APS Wallet BI</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;font-weight:600;color:#ffffff;">Scheduled report ready</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.text};">
                The report <strong>${reportName}</strong> was scheduled for your group
                <strong>${groupName}</strong> and is now available to view.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:8px;margin:0 0 24px;">
                <tr>
                  <td style="padding:20px 24px;font-size:14px;line-height:1.8;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.muted};">Schedule</p>
                    <p style="margin:0;color:${BRAND.text};"><strong>Due:</strong> ${when} UTC</p>
                    ${filterLabel ? `<p style="margin:8px 0 0;color:${BRAND.text};"><strong>Data range:</strong> ${filterLabel}</p>` : ''}
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${BRAND.muted};">
                ${
                  hasAttachments
                    ? 'PDF and CSV exports for this scheduled run are attached. You can also open the report in BI for interactive viewing.'
                    : 'Open the report in BI to view the latest data.'
                }
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:8px;background-color:${BRAND.blue};">
                    <a href="${reportUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View report</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:${BRAND.surface};border-top:1px solid ${BRAND.border};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted};text-align:center;">
                You received this because you belong to the scheduled recipient group.<br />
                &copy; APS Wallet BI
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

function logScheduleToConsole(payload: ReportScheduleEmailPayload) {
  console.log('[report-schedule] Email delivery fallback:', {
    to: payload.to,
    reportName: payload.reportName,
    groupName: payload.groupName,
    scheduledAt: payload.scheduledAt.toISOString(),
    reportUrl: payload.reportUrl,
    filterLabel: payload.filterLabel,
    attachments: payload.attachments?.map((a) => ({
      filename: a.filename,
      bytes: a.content.length,
    })),
  })
}

function resendAttachments(attachments: ReportScheduleAttachment[] | undefined) {
  if (!attachments?.length) return undefined
  return attachments.map((file) => ({
    filename: file.filename,
    content: file.content.toString('base64'),
  }))
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

function consoleFallbackWarning(): string {
  return 'Resend could not deliver the email. Notification was logged to the API server console.'
}

export async function sendReportScheduleEmail(
  payload: ReportScheduleEmailPayload,
): Promise<ReportScheduleDeliveryResult> {
  const subject = `Scheduled report ready: ${payload.reportName}`

  if (!isResendConfigured()) {
    logScheduleToConsole(payload)
    return {
      ok: true,
      channel: 'console',
      warning:
        'Resend is not configured (RESEND_API_KEY / RESEND_FROM). Notification logged to the server console.',
    }
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY!)
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM!,
      to: payload.to,
      subject,
      html: buildReportScheduleHtml(payload),
      attachments: resendAttachments(payload.attachments),
    })

    if (error) {
      console.error('[report-schedule] Resend API error:', error)
      if (shouldFallbackMailToConsole() && isLikelyConnectivityError(error)) {
        logScheduleToConsole(payload)
        return { ok: true, channel: 'console', warning: consoleFallbackWarning() }
      }
      return { ok: false, message: error.message ?? 'Resend rejected the email request' }
    }

    return { ok: true, channel: 'resend' }
  } catch (err) {
    console.error('[report-schedule] Resend request failed:', err)
    if (shouldFallbackMailToConsole() && isLikelyConnectivityError(err)) {
      logScheduleToConsole(payload)
      return { ok: true, channel: 'console', warning: consoleFallbackWarning() }
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to send scheduled report email',
    }
  }
}
