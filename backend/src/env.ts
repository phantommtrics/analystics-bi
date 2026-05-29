import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
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
})

export const env = envSchema.parse(process.env)

export function isResendConfigured() {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM)
}

export function shouldFallbackMailToConsole() {
  return env.MAIL_FALLBACK_CONSOLE || env.NODE_ENV !== 'production'
}
