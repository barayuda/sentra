/**
 * Jest configuration for the dual-runner demonstration (ADR 0002).
 * @swc/jest transforms TS (including ESM syntax) to CJS with no TypeScript
 * peer dependency; the mappers keep the source's explicit `.ts` extensions
 * and its `vitest` imports working untouched.
 */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript' }, target: 'es2022' } }],
  },
  moduleNameMapper: {
    '^vitest$': '<rootDir>/test/vitest-shim.ts',
    '^(\\.{1,2}/.*)\\.ts$': '$1',
  },
}
