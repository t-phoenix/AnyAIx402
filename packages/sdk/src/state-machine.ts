export type PaymentAttemptState =
  | "challenged"
  | "quoted"
  | "swap_authorized"
  | "swap_submitted"
  | "swap_submission_unknown"
  | "swap_confirmed"
  | "payment_signed"
  | "resource_retried"
  | "payment_submission_unknown"
  | "settlement_observed"
  | "settlement_unknown"
  | "completed"
  | "cancelled"
  | "quote_expired"
  | "swap_failed"
  | "payment_rejected"
  | "resource_failed_after_swap"
  | "manual_review";

export type PaymentAttemptEvent =
  | "quote_created"
  | "swap_authorized"
  | "swap_submitted"
  | "swap_submission_ambiguous"
  | "swap_confirmed"
  | "swap_failed"
  | "payment_signed"
  | "resource_retried"
  | "payment_submission_ambiguous"
  | "settlement_observed"
  | "settlement_ambiguous"
  | "payment_rejected"
  | "resource_failed"
  | "completed"
  | "cancelled"
  | "quote_expired"
  | "manual_review_required";

const transitions = {
  challenged: {
    quote_created: "quoted",
    cancelled: "cancelled",
  },
  quoted: {
    swap_authorized: "swap_authorized",
    quote_expired: "quote_expired",
    cancelled: "cancelled",
  },
  swap_authorized: {
    swap_submitted: "swap_submitted",
    cancelled: "cancelled",
  },
  swap_submitted: {
    swap_confirmed: "swap_confirmed",
    swap_failed: "swap_failed",
    swap_submission_ambiguous: "swap_submission_unknown",
  },
  swap_submission_unknown: {
    swap_submitted: "swap_submitted",
    swap_confirmed: "swap_confirmed",
    swap_failed: "swap_failed",
    manual_review_required: "manual_review",
  },
  swap_confirmed: {
    payment_signed: "payment_signed",
    resource_failed: "resource_failed_after_swap",
    manual_review_required: "manual_review",
  },
  payment_signed: {
    resource_retried: "resource_retried",
    payment_rejected: "payment_rejected",
    payment_submission_ambiguous: "payment_submission_unknown",
  },
  payment_submission_unknown: {
    resource_retried: "resource_retried",
    settlement_observed: "settlement_observed",
    payment_rejected: "payment_rejected",
    manual_review_required: "manual_review",
  },
  resource_retried: {
    settlement_observed: "settlement_observed",
    settlement_ambiguous: "settlement_unknown",
    payment_rejected: "payment_rejected",
    resource_failed: "resource_failed_after_swap",
  },
  settlement_unknown: {
    settlement_observed: "settlement_observed",
    payment_rejected: "payment_rejected",
    manual_review_required: "manual_review",
  },
  settlement_observed: {
    completed: "completed",
  },
  completed: {},
  cancelled: {},
  quote_expired: {},
  swap_failed: {},
  payment_rejected: {},
  resource_failed_after_swap: {},
  manual_review: {},
} as const satisfies Record<
  PaymentAttemptState,
  Partial<Record<PaymentAttemptEvent, PaymentAttemptState>>
>;

export class InvalidPaymentTransitionError extends Error {
  override readonly name = "InvalidPaymentTransitionError";

  constructor(
    readonly state: PaymentAttemptState,
    readonly event: PaymentAttemptEvent,
  ) {
    super(`Event ${event} is not allowed from state ${state}`);
  }
}

export function transitionPaymentAttempt(
  state: PaymentAttemptState,
  event: PaymentAttemptEvent,
): PaymentAttemptState {
  const next = (transitions[state] as Partial<Record<PaymentAttemptEvent, PaymentAttemptState>>)[
    event
  ];
  if (!next) {
    throw new InvalidPaymentTransitionError(state, event);
  }
  return next;
}

export function allowedPaymentEvents(state: PaymentAttemptState): readonly PaymentAttemptEvent[] {
  return Object.keys(transitions[state]) as PaymentAttemptEvent[];
}

export const TERMINAL_PAYMENT_STATES = Object.freeze([
  "completed",
  "cancelled",
  "quote_expired",
  "swap_failed",
  "payment_rejected",
  "resource_failed_after_swap",
  "manual_review",
] as const satisfies readonly PaymentAttemptState[]);
