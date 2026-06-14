import express from 'express'
import cors from 'cors'
import { env } from './env.js'
import { authRouter } from './routes/auth.js'
import { protectedRouter } from './routes/protected.js'
import { adminRouter } from './routes/admin/index.js'
import { reportBuilderRouter } from './routes/report-builder.js'
import { reportsRouter } from './routes/reports.js'
import { dashboardsRouter } from './routes/dashboards.js'
import { statementsRouter } from './routes/statements.js'
import { schedulesRouter } from './routes/schedules.js'
import { auditLogsRouter } from './routes/audit-logs.js'
import { directPayWebhooksRouter } from './routes/webhooks/directpay.js'
import { auditLogMiddleware } from './middleware/auditLog.js'
import { authenticate } from './middleware/authenticate.js'
import { requireActiveSubscription } from './middleware/requireActiveSubscription.js'
import { startReportScheduleProcessor } from './schedules/processor.js'
import { startStatementScheduleProcessor } from './schedules/statementProcessor.js'
import { startSubscriptionReminderProcessor } from './directpay/subscription-reminder-processor.js'

const app = express()

app.set('trust proxy', true)

app.use(
  cors({
    origin: env.CORS_ORIGIN,
  }),
)

app.use('/api/webhooks', directPayWebhooksRouter)

app.use(express.json())
app.use(auditLogMiddleware)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)

const subscriptionProtected = express.Router()
subscriptionProtected.use(authenticate)
subscriptionProtected.use(requireActiveSubscription)
subscriptionProtected.use('/report-builder', reportBuilderRouter)
subscriptionProtected.use('/reports', reportsRouter)
subscriptionProtected.use('/dashboards', dashboardsRouter)
subscriptionProtected.use('/statements', statementsRouter)
subscriptionProtected.use('/schedules', schedulesRouter)
subscriptionProtected.use('/audit-logs', auditLogsRouter)
subscriptionProtected.use('/', protectedRouter)

app.use('/api', subscriptionProtected)

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`)
  startReportScheduleProcessor()
  startStatementScheduleProcessor()
  startSubscriptionReminderProcessor()
})
