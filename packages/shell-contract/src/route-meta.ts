import type { Role } from './session.ts'

/**
 * Adds the role requirement to vue-router's `meta`.
 *
 * Declared in the contract package so that a remote can mark its own routes
 * without importing anything from the shell — the console declares
 * `requiresRole: 'ops'` on its routes, and the shell's guard reads it. A
 * module augmentation is the only way to make `meta` typed rather than
 * `Record<string, unknown>`.
 */
declare module 'vue-router' {
  interface RouteMeta {
    /** The role a user must hold to reach this route. */
    requiresRole?: Role
  }
}

export {}
