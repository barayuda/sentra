import { readonly, ref, type Ref } from 'vue'

/** Options accepted by {@link ToastService.show}. */
export interface ToastOptions {
  /** Short headline, always visible. */
  title: string
  /** Optional supporting line. */
  description?: string
  /** Visual and semantic tone; danger toasts announce assertively. */
  variant?: 'info' | 'success' | 'danger'
  /** Auto-dismiss delay in milliseconds; `0` means persistent. */
  durationMs?: number
}

/** A queued toast with defaults resolved and an identity assigned. */
export interface ToastInstance {
  id: number
  title: string
  description?: string
  variant: 'info' | 'success' | 'danger'
  durationMs: number
}

/** The imperative surface the plugin provides and `useToast()` returns. */
export interface ToastService {
  /** Live queue, newest last. Readonly — mutate only through show/dismiss. */
  toasts: Readonly<Ref<readonly ToastInstance[]>>
  /** Enqueues a toast and returns its id for targeted dismissal. */
  show(options: ToastOptions): number
  /** Removes a toast; unknown ids are ignored. */
  dismiss(id: number): void
}

/**
 * Creates an isolated toast queue. The service is a plain unit with no Vue
 * app dependency, which is what keeps it testable with fake timers and
 * reusable across app roots (each `app.use(toastPlugin)` gets its own).
 */
export function createToastService(): ToastService {
  const toasts = ref<ToastInstance[]>([])
  let nextId = 1

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function show(options: ToastOptions): number {
    const toast: ToastInstance = {
      id: nextId++,
      title: options.title,
      description: options.description,
      variant: options.variant ?? 'info',
      durationMs: options.durationMs ?? 5000,
    }
    toasts.value = [...toasts.value, toast]
    if (toast.durationMs > 0) {
      setTimeout(() => dismiss(toast.id), toast.durationMs)
    }
    return toast.id
  }

  return { toasts: readonly(toasts) as ToastService['toasts'], show, dismiss }
}
