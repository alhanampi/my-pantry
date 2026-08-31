import 'dotenv/config'
import app from './app'

if (!process.env.CLERK_SECRET_KEY) {
  console.error('ERROR: CLERK_SECRET_KEY environment variable is required')
  process.exit(1)
}

// Optional keys — same pattern as RESEND_API_KEY/VAPID_*: don't block boot,
// just warn. Their routes/services degrade gracefully (500 configError) if
// invoked without the key.
if (!process.env.SPOONACULAR_KEY) {
  console.warn('WARNING: SPOONACULAR_KEY not set — /api/recipes will return configError')
}
if (!process.env.GROQ_API_KEY) {
  console.warn('WARNING: GROQ_API_KEY not set — recipe content will not be translated')
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
