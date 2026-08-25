import type { PaymentReceipt, UPAErrorLike } from './types';

export interface SwapEvent {
  endpoint: string;
  inputToken: string;
  inputAmount: string;
  usdcRequired: string;
  fee: string;
}

export interface UPAEventMap {
  payment: PaymentReceipt;
  swap: SwapEvent;
  error: UPAErrorLike;
}

type Listener<K extends keyof UPAEventMap> = (payload: UPAEventMap[K]) => void;

/**
 * Minimal typed event emitter (no Node `EventEmitter` dependency, so this works in browser
 * bundles too). Mirrors the `upa.on('payment', handler)` API shown in docs/AGENTS.md and
 * docs/x402-universal-adapter-prd.md §5.1.
 */
export class UPAEventEmitter {
  private readonly listeners: {
    [K in keyof UPAEventMap]?: Set<Listener<K>>;
  } = {};

  on<K extends keyof UPAEventMap>(event: K, listener: Listener<K>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set<Listener<K>>() as never;
    }
    (this.listeners[event] as Set<Listener<K>>).add(listener);
  }

  off<K extends keyof UPAEventMap>(event: K, listener: Listener<K>): void {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.delete(listener);
  }

  emit<K extends keyof UPAEventMap>(event: K, payload: UPAEventMap[K]): void {
    for (const listener of (this.listeners[event] as Set<Listener<K>> | undefined) ?? []) {
      listener(payload);
    }
  }
}
