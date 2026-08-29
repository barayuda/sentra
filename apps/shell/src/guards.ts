import type { Session } from '@sentra/shell-contract'
import type { NavigationGuard } from 'vue-router'

/**
 * Builds a guard that enforces `meta.requiresRole`.
 *
 * The session is read through a callback rather than captured, so a role
 * change takes effect on the next navigation without rebuilding the router.
 *
 * A route with no `requiresRole` is public. This default is the safe one here
 * *because the shell owns no data*: every restricted view sits behind an API
 * that performs its own authorisation, and forgetting the meta flag therefore
 * costs a confusing screen, not a disclosure. Named risk area: access control.
 *
 * Checking `required` before reading the session also keeps `/forbidden`
 * itself reachable unconditionally — it carries no `requiresRole`, so a
 * visitor with no session at all still lands there instead of being bounced
 * back into a redirect loop.
 *
 * @param read - Returns the current session, or null when there is none.
 */
export function createRoleGuard(read: () => Session | null): NavigationGuard {
  return (to) => {
    const required = to.meta.requiresRole
    if (!required) return true
    const session = read()
    if (session && session.role === required) return true
    /* `from` is the path the visitor wanted, so the forbidden view can name it
       and offer a way back. It is a path this app defines, not user input
       rendered as markup — the view interpolates it as text. */
    return { name: 'forbidden', query: { from: to.fullPath } }
  }
}
