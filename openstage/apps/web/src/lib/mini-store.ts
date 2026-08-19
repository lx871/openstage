type Listener<T> = (s: T) => void

export function create<T>(initial: T) {
  let state = initial
  const listeners = new Set<Listener<T>>()
  return {
    get(): T { return state },
    set(next: T | ((s: T) => T)): void {
      const v = typeof next === 'function' ? (next as (s: T) => T)(state) : next
      state = v
      for (const l of listeners) l(state)
    },
    subscribe(fn: Listener<T>): () => void {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    use(): T {
      return state
    },
  }
}
