import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import authRoutes from './routes/auth'
import pantryRoutes from './routes/pantry'
import notificationsRoutes from './routes/notifications'
import recipesRoutes from './routes/recipes'
import shoppingListsRoutes from './routes/shoppingLists'
import chatRoutes from './routes/chat'

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
)
app.options('*', cors())
app.use(express.json({ limit: '10kb' }))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

const recipesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

// Tighter than recipesLimiter — streaming LLM calls are the most expensive
// thing in the app.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

app.use('/api/auth', limiter, authRoutes)
app.use('/api/pantry/shopping-lists', shoppingListsRoutes)
app.use('/api/pantry', pantryRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/recipes', recipesLimiter, recipesRoutes)
app.use('/api/chat', chatLimiter, chatRoutes)

app.get('/api/health', (_, res) => res.json({ status: 'ok' }))

export default app
