import type { App, Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { ShellBus } from './bus.ts'

/**
 * Analytics event names by category, as declared by a remote.
 *
 * Structurally identical to `@sentra/plugin-analytics`'s own `EventSchema`,
 * and restated here rather than imported so that a remote's contract does not
 * force an analytics dependency on the contract package.
 */
export type EventSchema = Record<string, readonly string[]>

/** What the shell hands a remote at registration time. */
export interface RemoteContext {
  /**
   * The shell's event bus. Available here, outside any component setup, so a
   * remote can subscribe to shell-wide events from its own store layer — the
   * storefront uses this to clear the cart when the session ends.
   */
  readonly bus: ShellBus
  /** The URL prefix the shell mounted this remote under, from the manifest. */
  readonly basePath: string
}

/**
 * What a federated remote exposes.
 *
 * A remote is not a mounted application. It is routes plus a registration
 * hook, because the shell owns the only router, the only history, and the
 * only URL. Two routers on one history fight over navigation, and a remote
 * that mounted its own `App` would need its own router to render anything.
 *
 * `register` exists because the shell holds the only `App` instance while a
 * remote's views need plugins the shell must not import — the storefront's
 * commerce client, the console's ops client. The shell calls `register` once,
 * before mounting, and the remote installs what its own views require.
 */
export interface RemoteModule {
  /**
   * Routes to graft under `basePath`. Paths are relative — `''` for the
   * index, `'orders'` for a child — never leading-slash absolute, because the
   * shell decides where they live.
   */
  readonly routes: readonly RouteRecordRaw[]
  /**
   * A component the shell renders alongside `<RouterView>` for as long as the
   * remote is loaded. This is how a remote contributes a drawer or modal that
   * must survive navigation away from its own routes — the storefront's cart.
   */
  readonly overlay?: Component
  /** Analytics events this remote emits, merged into the shell's schema. */
  readonly analyticsEvents?: EventSchema
  /**
   * Installs whatever this remote's views need on the shell's app.
   *
   * @param app - The shell's application instance.
   * @param ctx - See {@link RemoteContext}.
   */
  register(app: App, ctx: RemoteContext): void | Promise<void>
}
