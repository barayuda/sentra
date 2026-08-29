import type { Role, Session } from '@sentra/shell-contract'

/** Roles the demo can switch between. The full `Role` union, in guard order. */
export const SHELL_ROLES: readonly Role[] = ['shopper', 'ops']

/** localStorage key for the selected role. Demo affordance, not auth. */
const ROLE_STORAGE_KEY = 'sentra:role'

/**
 * Reads the persisted role, falling back to `shopper`.
 *
 * `shopper` is the default because the guard is only demonstrated by a visitor
 * who starts without the role and acquires it: spec §9's E2E walk is
 * `/ops` blocked → switch role → `/ops` loads. Defaulting to `ops` would make
 * every route reachable on a first visit and leave the guard untested by the
 * one suite written to exercise it.
 *
 * **This is not authentication.** The role lives in localStorage and the
 * client decides what it is, so a visitor can grant themselves `ops` from the
 * console. The route guard it feeds is a *navigation* control — it keeps the
 * UI coherent and stops a wrong-role user wandering into a broken view. Every
 * real authorisation decision belongs to the API that serves the data, which
 * is why `sdk-ops` maps 401/403 to its own `auth` error arm rather than
 * trusting this value. Named risk area: access control.
 */
export function initialSession(): Session {
  const stored = globalThis.localStorage?.getItem(ROLE_STORAGE_KEY)
  const role: Role = SHELL_ROLES.includes(stored as Role) ? (stored as Role) : 'shopper'
  return { id: 'demo-user', displayName: 'Demo User', role }
}

/**
 * Persists a role choice.
 *
 * @param role - The role to persist.
 */
export function setSessionRole(role: Role): void {
  globalThis.localStorage?.setItem(ROLE_STORAGE_KEY, role)
}
