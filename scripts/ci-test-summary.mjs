// Prints one markdown table row summarizing a Vitest JSON reporter output
// file, for appending to $GITHUB_STEP_SUMMARY. Usage:
//   node scripts/ci-test-summary.mjs "<label>" <path-to-vitest-json>
import { readFileSync } from 'node:fs'

const [, , label, jsonPath] = process.argv

let result
try {
  result = JSON.parse(readFileSync(jsonPath, 'utf8'))
} catch {
  console.log(`| ${label} | ⚠️ no results (step did not run) |`)
  process.exit(0)
}

const { numTotalTests, numPassedTests, numFailedTests, success } = result
const icon = success ? '✅' : '❌'
const detail = numFailedTests > 0
  ? `${numPassedTests}/${numTotalTests} passed, ${numFailedTests} failed`
  : `${numPassedTests}/${numTotalTests} passed`

console.log(`| ${label} | ${icon} ${detail} |`)
