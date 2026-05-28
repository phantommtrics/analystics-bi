import express from 'express'
import cors from 'cors'
import { env } from './env.js'
import { authRouter } from './routes/auth.js'
import { protectedRouter } from './routes/protected.js'

const app = express()

app.use(
  cors({
    origin: env.CORS_ORIGIN,
  }),
)
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api', protectedRouter)

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`)
})
