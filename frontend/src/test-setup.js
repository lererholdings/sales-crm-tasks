import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest doesn't expose afterEach as a true global (unlike Jest), so
// @testing-library/react's automatic cleanup detection doesn't kick in on
// its own — without this, DOM from one test leaks into the next within the
// same file, causing "multiple elements found" failures.
afterEach(() => {
  cleanup()
})
