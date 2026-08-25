import type { UPAEventMap, UPAEventName } from './types.js';

type Listener<K extends UPAEventName> = (payload: UPAEventMap[K]) => void;

/**
 * A three-event emitter. Node's EventEmitter is not available in every runtime
 * the SDK targets, and pulling in a polyfill for this would be absurd.
 */
export class Emitter {
  private readonly listeners = new Map<UPAEventName, Set<Listener<UPAEventName>>>();

  on<K extends UPAEventName>(event: K, listener: Listener<K>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as Listener<UPAEventName>);
    this.listeners.set(event, set);
    return () => this.off(event, listener);
  }

  once<K extends UPAEventName>(event: K, listener: Listener<K>): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends UPAEventName>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener as Listener<UPAEventName>);
  }

  /**
   * A throwing listener must not take down the payment that triggered it, so
   * failures here are swallowed rather than propagated.
   */
  emit<K extends UPAEventName>(event: K, payload: UPAEventMap[K]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      try {
        (listener as Listener<K>)(payload);
      } catch {
        // A listener's problem is not the payment's problem.
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
