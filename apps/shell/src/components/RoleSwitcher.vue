<script setup lang="ts">
import { useSession, type Role } from '@sentra/shell-contract'
import { SHELL_ROLES, setSessionRole } from '../session.ts'

const session = useSession()

/**
 * Persists the chosen role, then reloads.
 *
 * The session ref lives in a plugin the remotes already captured at register
 * time — there is no re-registration protocol that would let an already
 * mounted remote pick up a new role reactively, and inventing one for a demo
 * switcher is not something a real app would do. A full reload is the honest
 * way to demonstrate a role change here: everything re-registers from
 * scratch against the freshly persisted role.
 */
function onChange(event: Event): void {
  const role = (event.target as HTMLSelectElement).value as Role
  setSessionRole(role)
  globalThis.location.reload()
}
</script>

<template>
  <select
    aria-label="Role"
    class="rounded border border-slate-300 px-2 py-1 text-sm"
    :value="session?.role"
    @change="onChange"
  >
    <option v-for="role in SHELL_ROLES" :key="role" :value="role">{{ role }}</option>
  </select>
</template>
