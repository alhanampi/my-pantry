import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    // Scoped to src/ so a populated dist/ (from `npm run build`) doesn't get
    // swept up too — the compiled .test.js output there would otherwise run
    // as CommonJS and fail with "Vitest cannot be imported using require()".
    include: ['src/**/*.{test,spec}.ts'],
  },
})
