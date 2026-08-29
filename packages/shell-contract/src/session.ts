import { inject, readonly, ref, type InjectionKey, type Plugin, type Ref } from 'vue'

/** What a signed-in user is allowed to reach. */
export type Role = 'shopper' | 'ops'

/** The signed-in user, as far as any remote is concerned. */
export interface Session {
  /** Opaque identifier. Never an email, never a national ID. */
  readonly id: string
  /** Display label. A demo pseudonym, not a real person's name. */
  readonly displayName: string
  /** What this user may reach. */
  readonly role: Role
}

/** Injection key for the session. A namespaced string — see {@link SHELL_BUS_INJECTION_KEY}. */
export const SESSION_INJECTION_KEY = 'sentra:session' as unknown as InjectionKey<
  Readonly<Ref<Session | null>>
>

/** What {@link createSessionPlugin} hands back. */
export interface SessionPluginHandle {
  /** Install this on the app. */
  readonly plugin: Plugin<[]>
  /** Write here to sign in or out. The shell owns this reference. */
  readonly session: Ref<Session | null>
}

/**
 * Creates the session state and the plugin that publishes it.
 *
 * The writable `Ref` is returned to the caller and only the read-only view is
 * provided, so the shell can change who is signed in while a remote cannot.
 * That asymmetry is the point: authentication is the host's job, and a remote
 * that could assign to the session could grant itself a role.
 *
 * @param initial - Who is signed in at boot, or null.
 */
export function createSessionPlugin(initial: Session | null): SessionPluginHandle {
  const session = ref<Session | null>(initial)
  return {
    session,
    plugin: {
      install(app) {
        app.provide(SESSION_INJECTION_KEY, readonly(session) as Readonly<Ref<Session | null>>)
      },
    },
  }
}

/**
 * Reads the session from a component's setup.
 *
 * Returns a ref holding `null` when no session was provided — a remote
 * rendered outside the shell is simply signed out, which is both true and
 * the safe default. Contrast `useShellBus()`, which throws.
 */
export function useSession(): Readonly<Ref<Session | null>> {
  return inject(SESSION_INJECTION_KEY, readonly(ref<Session | null>(null)))
}
