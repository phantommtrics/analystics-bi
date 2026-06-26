import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  APP_PUBLIC_URL: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  /** When true, log invite credentials to the console if Resend cannot deliver */
  MAIL_FALLBACK_CONSOLE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  /** 32-byte key (base64) for encrypting external database credentials */
  DATASOURCE_ENCRYPTION_KEY: z.string().min(1),
  /** DirectPay internal partner API (optional until integration is configured) */
  DIRECTPAY_API_BASE_URL: z.string().optional(),
  DIRECTPAY_INTERNAL_PARTNER_API_SECRET: z.string().optional(),
  DIRECTPAY_PUBLIC_APP_URL: z.string().optional(),
  DIRECTPAY_WEBHOOK_SECRET: z.string().optional(),
  /** How often the API checks for due report schedules (milliseconds) */
  REPORT_SCHEDULE_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .max(86_400_000)
    .default(60_000),
  /** Subscription billing reminder emails when cycle length is under 30 days */
  SUBSCRIPTION_REMINDER_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .max(3_600_000)
    .default(60_000),
  /** IANA timezone for daily 00:00 sends (production). Default UTC. */
  SUBSCRIPTION_REMINDER_TIMEZONE: z.string().default('UTC'),
  /** When true, first reminder fires after SUBSCRIPTION_REMINDER_TEST_DELAY_MS, then repeats at that interval. */
  SUBSCRIPTION_REMINDER_TEST_MODE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  /** Delay before first test reminder (default 2 minutes). */
  SUBSCRIPTION_REMINDER_TEST_DELAY_MS: z.coerce
    .number()
    .int()
    .min(10_000)
    .max(3_600_000)
    .default(120_000),
})

export const env = envSchema.parse(process.env)

export function isResendConfigured() {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM)
}

export function shouldFallbackMailToConsole() {
  return env.MAIL_FALLBACK_CONSOLE || env.NODE_ENV !== 'production'
}
