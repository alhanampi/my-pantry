// Fake values for env vars read at module-load time by app.ts's transitive
// imports (routes/auth.ts, middleware/auth.ts, services/webpush.ts), so
// `import app from '../app'` never crashes in tests for lack of real secrets.
process.env.CLERK_SECRET_KEY ??= 'test_clerk_secret_key'
process.env.FRONTEND_ORIGIN ??= 'http://localhost:5173'
process.env.CRON_SECRET ??= 'test_cron_secret'
process.env.VAPID_SUBJECT ??= 'mailto:test@example.com'
process.env.VAPID_PUBLIC_KEY ??= 'BHzqze4Kg0l4LJq216hqsXh-ckEYVvW0zrF6wc7W0ln18v9xQwqceS6AL8dOU9DXIE_bS_Cv-Q4_9zIXRSfDlTY'
process.env.VAPID_PRIVATE_KEY ??= 'ZzXkNFuBVO_88ldbXOek8HHSxVb-6BhmNa47ZjYbdEM'
process.env.RESEND_API_KEY ??= 'test_resend_key'
process.env.EMAIL_FROM ??= 'test@example.com'
