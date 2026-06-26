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
import { requestLogMiddleware } from './middleware/requestLog.js'
import { authenticate } from './middleware/authenticate.js'
import { requireActiveSubscription } from './middleware/requireActiveSubscription.js'
import { startReportScheduleProcessor } from './schedules/processor.js'
import { startStatementScheduleProcessor } from './schedules/statementProcessor.js'
import { startSubscriptionReminderProcessor } from './directpay/subscription-reminder-processor.js'
import { startPartnerAgentFloatProcessor } from './partner-agent-float/processor.js'
import { partnerAgentFloatRouter } from './routes/partner-agent-float.js'
import { log } from './utils/logger.js'

const app = express()

app.set('trust proxy', true)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      if (env.CORS_ORIGIN.includes(origin)) {
        callback(null, true)
        return
      }

      if (
        env.NODE_ENV === 'development' &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true)
        return
      }

      callback(null, false)
    },
  }),
)

app.use('/api/webhooks', directPayWebhooksRouter)

app.use(express.json())
app.use(requestLogMiddleware)
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
subscriptionProtected.use('/partner-agent-float', partnerAgentFloatRouter)
subscriptionProtected.use('/audit-logs', auditLogsRouter)
subscriptionProtected.use('/', protectedRouter)

app.use('/api', subscriptionProtected)

app.listen(env.PORT, () => {
  log('server', `API listening on http://localhost:${env.PORT}`)
  startReportScheduleProcessor()
  startStatementScheduleProcessor()
  startSubscriptionReminderProcessor()
  startPartnerAgentFloatProcessor()
})
