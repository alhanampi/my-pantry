import 'dotenv/config'
import app from './app'

if (!process.env.CLERK_SECRET_KEY) {
  console.error('ERROR: CLERK_SECRET_KEY environment variable is required')
  process.exit(1)
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
