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
import { auditLogMiddleware } from './middleware/auditLog.js'
import { startReportScheduleProcessor } from './schedules/processor.js'
import { startStatementScheduleProcessor } from './schedules/statementProcessor.js'

const app = express()

app.set('trust proxy', true)

app.use(
  cors({
    origin: env.CORS_ORIGIN,
  }),
)
app.use(express.json())
app.use(auditLogMiddleware)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/report-builder', reportBuilderRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/dashboards', dashboardsRouter)
app.use('/api/statements', statementsRouter)
app.use('/api/schedules', schedulesRouter)
app.use('/api/audit-logs', auditLogsRouter)
app.use('/api', protectedRouter)

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`)
  startReportScheduleProcessor()
  startStatementScheduleProcessor()
})
