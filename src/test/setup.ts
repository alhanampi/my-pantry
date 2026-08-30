import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// With `globals: false`, RTL's automatic afterEach(cleanup) never registers
// (it hooks into the global afterEach, which isn't defined). Do it explicitly
// so each test starts from an empty DOM instead of accumulating renders.
afterEach(() => {
  cleanup()
})

// jsdom doesn't implement matchMedia — MUI's useMediaQuery (used in PantryView) needs it.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
