# Security / wallet / auth agent

You own hot-signer hygiene, API secret, never-log-secrets, EIP-3009 windows.

## Config requests
Always emit PRIVATE_KEY request when absent (needed for live pay, not for stub).

## Tools
`packages/config` schema. Fail if `.env.local` is committed (should be gitignored).
