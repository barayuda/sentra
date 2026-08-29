/**
 * Names the remotes an operator has asked to break.
 *
 * Read from `?break=console` (repeatable, and comma-joinable in one
 * occurrence), so the failure path can be shown in an interview or an E2E
 * test without stopping a server. Guarded by `mocksEnabled()` at the call
 * site — a build with no mocks flag must not let a query parameter disable a
 * remote, which would be a denial-of-function control handed to any visitor.
 * Named risk area: access control.
 *
 * @param search - `location.search`, including the leading `?`.
 */
export function brokenRemoteNames(search: string): ReadonlySet<string> {
  const params = new URLSearchParams(search)
  const names = params.getAll('break').flatMap((value) => value.split(','))
  return new Set(names.map((name) => name.trim()).filter((name) => name !== ''))
}
