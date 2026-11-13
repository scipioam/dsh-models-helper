import { defineConfig } from 'vitest/config'

// One worker, one file at a time: the project is developed on small machines
// and the suites are pure-logic tests that gain nothing from parallelism.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    passWithNoTests: true,
  },
})
