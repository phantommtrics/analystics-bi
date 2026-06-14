import { env } from '../env.js'
import { sendSubscriptionReminderEmail } from '../mail/subscriptionReminder.js'
import { prisma } from '../prisma.js'
import { log, logError } from '../utils/logger.js'
import { getDirectPayPartnerConfig } from './client.js'
import {
  daysUntilPeriodEnd,
  isDailyMidnightSendWindow,
  isReminderEligibleStatus,
  isShortSubscriptionCycle,
  isTestModeSendDue,
  subscriptionCycleLengthDays,
} from './subscription-reminder.js'
import { syncOrganizationSubscription } from './subscription-sync.js'

let pollTimer: ReturnType<typeof setInterval> | null = null
let processing = false
const processorStartedAt = new Date()

export function startSubscriptionReminderProcessor() {
  if (pollTimer) return

  const pollMs = env.SUBSCRIPTION_REMINDER_POLL_INTERVAL_MS
  void processSubscriptionReminders()
  pollTimer = setInterval(() => {
    void processSubscriptionReminders()
  }, pollMs)

  if (env.SUBSCRIPTION_REMINDER_TEST_MODE) {
    const delayMin = Math.round(env.SUBSCRIPTION_REMINDER_TEST_DELAY_MS / 60_000)
    log(
      'subscription-reminder',
      `Test mode: first send ~${delayMin} min after boot, then every ${delayMin} min`,
    )
  } else {
    log(
      'subscription-reminder',
      `Processor started (daily 00:00 ${env.SUBSCRIPTION_REMINDER_TIMEZONE}, poll every ${pollMs / 1000}s)`,
    )
  }
}

export function stopSubscriptionReminderProcessor() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export async function processSubscriptionReminders() {
  if (processing) return
  processing = true

  try {
    const { configured } = getDirectPayPartnerConfig()
    if (!configured) return

    const orgs = await prisma.organization.findMany({
      where: {
        billingOwnerEmail: { not: null },
        directPayBusinessId: { not: null },
      },
      select: {
        id: true,
        name: true,
        billingOwnerEmail: true,
        billingOwnerName: true,
        subscriptionStatus: true,
        subscriptionPlanCode: true,
        subscriptionPeriodStart: true,
        subscriptionPeriodEnd: true,
        subscriptionPayUrl: true,
        subscriptionReminderLastSentAt: true,
      },
    })

    const now = new Date()

    for (const org of orgs) {
      try {
        await maybeSendReminderForOrg(org, now)
      } catch (err) {
        logError('subscription-reminder', `Failed for org ${org.id}:`, err)
      }
    }
  } catch (err) {
    logError('subscription-reminder', 'Processor error:', err)
  } finally {
    processing = false
  }
}

async function maybeSendReminderForOrg(
  org: {
    id: string
    name: string
    billingOwnerEmail: string | null
    billingOwnerName: string | null
    subscriptionStatus: string | null
    subscriptionPlanCode: string | null
    subscriptionPeriodStart: Date | null
    subscriptionPeriodEnd: Date | null
    subscriptionPayUrl: string | null
    subscriptionReminderLastSentAt: Date | null
  },
  now: Date,
) {
  const email = org.billingOwnerEmail?.trim()
  if (!email) return

  await syncOrganizationSubscription(org.id)

  const fresh = await prisma.organization.findUnique({
    where: { id: org.id },
    select: {
      id: true,
      name: true,
      billingOwnerEmail: true,
      billingOwnerName: true,
      subscriptionStatus: true,
      subscriptionPlanCode: true,
      subscriptionPeriodStart: true,
      subscriptionPeriodEnd: true,
      subscriptionPayUrl: true,
      subscriptionReminderLastSentAt: true,
    },
  })
  if (!fresh?.billingOwnerEmail) return

  if (!isReminderEligibleStatus(fresh.subscriptionStatus)) return
  if (
    !isShortSubscriptionCycle(fresh.subscriptionPeriodStart, fresh.subscriptionPeriodEnd)
  ) {
    return
  }

  const testMode = env.SUBSCRIPTION_REMINDER_TEST_MODE
  const sendDue = testMode
    ? isTestModeSendDue(
        now,
        fresh.subscriptionReminderLastSentAt,
        processorStartedAt,
        env.SUBSCRIPTION_REMINDER_TEST_DELAY_MS,
      )
    : isDailyMidnightSendWindow(
        now,
        fresh.subscriptionReminderLastSentAt,
        env.SUBSCRIPTION_REMINDER_TIMEZONE,
      )

  if (!sendDue) return

  const cycleLengthDays = subscriptionCycleLengthDays(
    fresh.subscriptionPeriodStart,
    fresh.subscriptionPeriodEnd,
  )
  const daysRemaining = daysUntilPeriodEnd(fresh.subscriptionPeriodEnd, now)

  const result = await sendSubscriptionReminderEmail({
    to: fresh.billingOwnerEmail,
    billingOwnerName: fresh.billingOwnerName?.trim() || 'Billing owner',
    organizationName: fresh.name,
    subscriptionStatus: fresh.subscriptionStatus ?? 'UNKNOWN',
    planCode: fresh.subscriptionPlanCode,
    periodEnd: fresh.subscriptionPeriodEnd,
    daysRemaining,
    cycleLengthDays,
    payUrl: fresh.subscriptionPayUrl,
  })

  if (!result.ok) {
    logError('subscription-reminder', `Email failed for ${fresh.id}:`, result.message)
    return
  }

  await prisma.organization.update({
    where: { id: fresh.id },
    data: { subscriptionReminderLastSentAt: now },
  })

  log(
    'subscription-reminder',
    `Sent to ${fresh.billingOwnerEmail} (${result.channel}) org=${fresh.name}`,
  )
}
