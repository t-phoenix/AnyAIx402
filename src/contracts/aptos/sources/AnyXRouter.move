module anyx_x402::router {
    use std::signer;
    use std::error;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::account;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::timestamp;

    /// Error codes
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INSUFFICIENT_AMOUNT: u64 = 2;
    const E_PAYMENT_EXPIRED: u64 = 3;
    const E_ALREADY_INITIALIZED: u64 = 4;
    const E_NONCE_REPLAY: u64 = 5;

    struct Config has key {
        admin: address,
        fee_collector: address,
        fee_bps: u64, // e.g. 20 for 0.20%
    }

    struct PaymentEvent has drop, store {
        payer: address,
        recipient: address,
        amount: u64,
        fee: u64,
        nonce: vector<u8>,
        timestamp: u64,
    }

    struct RouterState has key {
        payment_events: EventHandle<PaymentEvent>,
    }

    /// Initialize AnyX Router on Aptos
    public entry fun initialize(
        admin: &signer,
        fee_collector: address,
        fee_bps: u64
    ) {
        let admin_addr = signer::address_of(admin);
        assert!(!exists<Config>(admin_addr), error::already_exists(E_ALREADY_INITIALIZED));

        move_to(admin, Config {
            admin: admin_addr,
            fee_collector,
            fee_bps,
        });

        move_to(admin, RouterState {
            payment_events: account::new_event_handle<PaymentEvent>(admin),
        });
    }

    /// Settle a payment on Aptos with protocol fee deduction
    public entry fun settle_payment<CoinType>(
        payer: &signer,
        admin_addr: address,
        recipient: address,
        amount: u64,
        nonce: vector<u8>,
        valid_until: u64
    ) acquires Config, RouterState {
        let now = timestamp::now_seconds();
        assert!(now <= valid_until, error::invalid_argument(E_PAYMENT_EXPIRED));

        let config = borrow_global<Config>(admin_addr);
        let fee_amount = (amount * config.fee_bps) / 10000;
        let recipient_amount = amount - fee_amount;

        let payer_addr = signer::address_of(payer);

        // Transfer payment to recipient
        coin::transfer<CoinType>(payer, recipient, recipient_amount);

        // Transfer fee to collector if fee > 0
        if (fee_amount > 0) {
            coin::transfer<CoinType>(payer, config.fee_collector, fee_amount);
        };

        // Emit payment event
        let state = borrow_global_mut<RouterState>(admin_addr);
        event::emit_event(
            &mut state.payment_events,
            PaymentEvent {
                payer: payer_addr,
                recipient,
                amount,
                fee: fee_amount,
                nonce,
                timestamp: now,
            }
        );
    }
}
