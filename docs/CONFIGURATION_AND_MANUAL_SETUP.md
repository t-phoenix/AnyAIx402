# Configuration and manual setup

Status: proposed operator model. No accounts, credentials, infrastructure, or production wallets
have been created.

## 1. One configuration surface

All non-secret project configuration belongs in `.anyx/sdlc.yaml`, validated against a pinned
JSON Schema. It contains **secret references**, never values. Environment-specific overrides are
explicit documents selected by name, not ad hoc environment variables. Organization policy is
merged first; repository policy may only tighten it.

Resolution order:

1. immutable organization policy;
2. repository `.anyx/sdlc.yaml`;
3. selected environment block;
4. approved, time-limited workflow override.

Unknown keys, duplicate IDs, inline secret-like values, unresolved references, excessive
permissions, and unsupported schema versions fail closed.

## 2. Sample `.anyx/sdlc.yaml`

```yaml
apiVersion: sdlc.anyx.dev/v1alpha1
kind: RepositoryAutomation

metadata:
  project: anyai-x402
  repository: github:example/AnyAIx402

product:
  mode: payment-adapter # decision required: payment-adapter | ai-gateway | separate-planes
  decisionsPath: docs/DECISIONS_REQUIRED.md
  acceptedAdrGlob: docs/adr/*.md

contracts:
  schemaRegistry: oci://ghcr.io/example/anyx-contracts
  acceptedMajorVersions: [1]

github:
  appSecretRef: secret://github/anyx-sdlc-app
  defaultBranch: main
  requiredChecks: [lint, typecheck, unit, integration, appsec, qa]
  protectedEnvironments: [staging, production]

orchestrator:
  backend: temporal
  endpointRef: secret://orchestrator/endpoint
  namespace: anyx
  taskQueues:
    planning: anyx-plan-v1
    implementation: anyx-build-v1
    verification: anyx-verify-v1
  maxFixLoops: 3

workers:
  isolation: ephemeral-vm
  defaultImage: ghcr.io/example/anyx-worker@sha256:REDACTED_DIGEST
  egressPolicy: allowlist
  allowedDomains:
    - github.com
    - api.github.com
    - registry.npmjs.org
  resources:
    cpu: "4"
    memory: 8Gi
    storage: 20Gi
    timeout: 30m

models:
  planner:
    provider: openai-compatible
    credentialRef: secret://ai/planner-api-key
    model: APPROVED_MODEL_ID
  implementer:
    provider: openai-compatible
    credentialRef: secret://ai/implementer-api-key
    model: APPROVED_MODEL_ID
  reviewer:
    provider: openai-compatible
    credentialRef: secret://ai/reviewer-api-key
    model: APPROVED_MODEL_ID
  dataRetention: none

budgets:
  workflow:
    maxCostUsd: 25
    maxDuration: 4h
    maxTasks: 12
  task:
    maxCostUsd: 8
    maxDuration: 45m
    maxCommands: 100
    maxChangedFiles: 25
  concurrency:
    implementation: 3
    verification: 4

checks:
  independentReview: true
  independentAppSec: true
  independentQa: true
  requireFreshEnvironment: true
  prohibitSelfApproval: true

payments:
  enabled: false # remains false until architecture gates pass
  x402:
    protocolVersion: "PIN_REQUIRED"
    merchantOwnsSettlement: true
    network: "eip155:8453"
    asset: "CAIP19_USDC_ID_REQUIRED"
  rpc:
    primaryRef: secret://payments/base-rpc-primary-url
    fallbackRef: secret://payments/base-rpc-fallback-url
  dex:
    provider: DECISION_REQUIRED
    apiKeyRef: secret://payments/dex-api-key
  signer:
    mode: client-wallet
    serverKeyRef: null
  limits:
    perPaymentUsd: 0
    dailyUsd: 0

aiGateway:
  enabled: false
  providers:
    openai:
      apiKeyRef: secret://inference/openai-api-key
    openaiCompatible:
      baseUrlRef: secret://inference/compatible-base-url
      apiKeyRef: secret://inference/compatible-api-key

artifacts:
  registry: ghcr.io/example
  signingKeyRef: secret://release/cosign-kms-key
  evidenceBucketRef: secret://release/evidence-bucket
  retentionDays: 365

deployments:
  cloudIdentityRef: secret://cloud/deployer-identity
  environments:
    staging:
      approval: service-owner
      trafficPercent: 100
    production:
      approval: [service-owner, security-owner]
      canaryPercents: [1, 5, 25, 100]
      observationMinutes: 30
      rollbackOn:
        errorRateIncreasePercent: 2
        duplicatePaymentCount: 1

approvals:
  production: [service-owner, security-owner]
  treasury: [treasury-approver-a, treasury-approver-b]
  signerRotation: [security-owner, treasury-approver-a]
  legalBoundary: [compliance-owner]

notifications:
  incidentWebhookRef: secret://notifications/incident-webhook
  securityWebhookRef: secret://notifications/security-webhook
```

Placeholders such as `PIN_REQUIRED`, `DECISION_REQUIRED`, and `REDACTED_DIGEST` make validation
fail until intentionally replaced with approved non-secret values.

## 3. Secret reference catalog

Secret-store paths are illustrative. The store may be cloud KMS/secret manager or Vault.

| Reference | Purpose | Required phase |
| --- | --- | --- |
| `secret://github/anyx-sdlc-app` | GitHub App private key/webhook secret | SDLC setup |
| `secret://orchestrator/endpoint` | Orchestrator mTLS/connection material | SDLC setup |
| `secret://ai/*-api-key` | Build-time model credentials | SDLC setup |
| `secret://release/cosign-kms-key` | Artifact signing via KMS, not exported key | Release |
| `secret://release/evidence-bucket` | Evidence-store credentials/location | SDLC setup |
| `secret://cloud/deployer-identity` | Workload identity, preferably no static key | Deployment |
| `secret://notifications/*-webhook` | Incident/security delivery | Operations |
| `secret://payments/base-rpc-*-url` | Authenticated RPC URLs | Payment sandbox |
| `secret://payments/dex-api-key` | DEX quote/execution API | Payment sandbox |
| `secret://payments/facilitator-credential` | Only if pinned facilitator requires it | Protocol proof |
| `secret://payments/client-test-wallet` | Test-only wallet in isolated test secret store | Testnet only |
| `secret://payments/treasury-*` | Future inventory roles/limits | Not MVP |
| `secret://inference/openai-api-key` | Optional runtime AI gateway | If D1 approves |
| `secret://inference/compatible-*` | Optional compatible provider endpoint/key | If D1 approves |
| `secret://billing/stripe-*` | Future subscriptions/webhook verification | Post-MVP |
| `secret://dns/provider-token` | DNS automation with zone-scoped rights | Deployment |

Never place private keys, seed phrases, macaroon contents, TLS private keys, API keys, database
passwords, bearer tokens, webhook secrets, or complete authenticated URLs in YAML, `.env`
examples, logs, issues, prompts, artifacts, or repository secrets visible to untrusted workers.

Environment-variable names, where a process adapter requires them, should contain references:

```text
ANYX_CONFIG_PATH=.anyx/sdlc.yaml
ANYX_ENVIRONMENT=staging
ANYX_SECRET_PROVIDER=cloud-secret-manager
ANYX_WORKLOAD_IDENTITY_AUDIENCE=anyx-sdlc
```

Provider SDK variables such as `OPENAI_API_KEY` or `DATABASE_URL` are injected into the specific
process at runtime and never propagated to general build workers.

## 4. Validation and doctor flow

Proposed CLI:

```text
anyx init
anyx config schema
anyx config validate --environment staging
anyx doctor --environment staging
anyx doctor --environment production --read-only
anyx plan
```

`anyx config validate` performs offline checks:

- schema and major-version compatibility;
- no inline secrets or secret-like high-entropy values;
- all IDs and task queues unique;
- references syntactically valid;
- role separation and max fix loops exactly three or less;
- required checks, budgets, canary and rollback policy present;
- payment mode consistent with accepted ADRs;
- no server signer in self-custodial mode.

`anyx doctor` adds read-only connectivity:

- resolve secret metadata without printing values;
- GitHub App installation, webhook, branch protection, environments, checks;
- workflow backend namespace/task queues;
- worker image digest/signature and isolation capability;
- artifact/evidence read-write test using disposable objects;
- model endpoint model-list/minimal non-sensitive request and retention setting;
- RPC chain/genesis/USDC contract checks;
- x402 merchant/facilitator compatibility fixture;
- DEX quote-only smoke test and chain/token support;
- database/Redis TLS, migration status, and least-privileged roles;
- cloud workload identity, registry, DNS, telemetry, alert delivery;
- time synchronization and certificate expiry.

Output is a redacted, signed report with `pass`, `warn`, `blocked`, remediation text, and evidence
hashes. Doctor never submits a mainnet transaction, changes DNS, deploys, rotates keys, or funds
a wallet.

## 5. Setup wizard UX

`anyx init` should:

1. Detect repository and existing organization policy.
2. Ask the product mode question first.
3. Generate `.anyx/sdlc.yaml` with blocking placeholders.
4. Show required external accounts by selected phases.
5. Create secret-reference names, not secrets.
6. Test local schema validation.
7. Print manual actions with owner and verification command.
8. Refuse to enable payments, inference, deployment, or treasury until corresponding decisions,
   secrets, policy, and approvals pass.

The wizard is resumable. Its state records completion evidence, not credential values.

## 6. Unavoidable manual setup

### A. Product, ownership, and legal

1. Product owner approves payment-adapter, AI-gateway, or separate-planes identity.
2. Lead architect records accepted ADRs; proposed ADRs are insufficient.
3. Assign service, security, data, compliance, incident, and two treasury owners.
4. Counsel reviews swap-spread model, sanctions obligations, money transmission/custody,
   Lightning, jurisdiction, consumer disclosures, taxes, and privacy.
5. Approve terms, privacy notice, retention schedule, acceptable-use policy, and incident
   communication owner.
6. Do not market “non-custodial,” “first,” revenue, or market claims until substantiated.

### B. GitHub

1. Create a GitHub App owned by the organization.
2. Grant only required repository metadata, contents, pull request, issue, checks, and deployment
   permissions; avoid organization administration.
3. Configure and verify webhook signature secret.
4. Install only on selected repositories.
5. Protect `main`: PR required, signed/verified checks, no force-push, no direct writes.
6. Create staging/production environments with named human reviewers.
7. Enable secret scanning, dependency alerts, code scanning, and immutable release policy.
8. Register workload identity for artifact publishing rather than static personal tokens.

### C. Build-time AI providers and billing

1. Create organization-owned provider projects, not personal accounts.
2. Approve models, regions, data-retention/training settings, and vendor terms.
3. Set hard billing limits and alerts.
4. Create separate credentials per role/environment; store in secret manager.
5. Verify no-retention or approved retention contractually and through provider settings.
6. If an AI inference gateway is approved, create separate runtime provider projects and billing
   from build-time agents.

### D. x402 and facilitators

1. Select and pin current x402 v2 package versions and source commits.
2. Record standard header/schema fixtures and CAIP identifiers.
3. Deploy or obtain a sandbox merchant endpoint.
4. Select a facilitator compatible with the pinned version and document authentication,
   limits, supported networks/assets, verify/settle behavior, availability, and terms.
5. Confirm with executable tests that the merchant owns verification and settlement.
6. Obtain production access/allowlisting if required; configure alerts and fallback policy.
7. Never copy facilitator examples from historical source documents without revalidation.

### E. Wallets and signers

Self-custodial MVP:

1. Select supported wallet clients and typed-data capabilities.
2. Create an isolated testnet wallet with minimal funds through an approved wallet process.
3. Store only a test secret reference where automation is necessary.
4. Confirm swap output recipient and EIP-3009 signer are the payer.
5. Set test and production value caps; production agents never receive a user seed/private key.

Future service signer/inventory:

1. Obtain legal and security approval first.
2. Select HSM/MPC provider and regions.
3. Conduct two-person key ceremony; keys are non-exportable.
4. Configure contract/recipient/value/rate/time policy, rotation, recovery, and emergency pause.
5. Separate signer, treasury, deployer, fee collector, and reconciliation identities.
6. Create double-entry ledger accounts before funding.
7. Fund only after canary approval; record transaction and ledger evidence.

Lightning additionally requires LND/Core Lightning operations, TLS/macaroon provisioning,
channels/liquidity, backups, watchtowers, refunds, and compliance approval. It is not MVP setup.

### F. RPC and DEX providers

1. Create organization-owned Base testnet/mainnet RPC projects with separate credentials.
2. Configure two independent providers, quotas, billing alerts, archive needs, and allowed
   origins/IPs.
3. Create DEX API account under commercial terms; confirm chains, tokens, rate limits, fee
   recipient support, attribution, and calldata guarantees.
4. Register only audited/verified router addresses and selectors.
5. Test quote and execution on testnet/fork with strict output recipient, allowance, max-input,
   and min-output validation.
6. Approve route-level minimum payment size after gas/economic tests.

### G. Cloud, data, observability, and DNS

1. Create separate staging/production cloud projects/accounts.
2. Configure workload identity, least-privileged service accounts, private networks, egress
   allowlists, KMS, secret manager, registry, evidence bucket, and audit-log retention.
3. Provision managed PostgreSQL/Redis with TLS, backups, PITR, restricted networks, separate
   migration/runtime roles, and restore exercise.
4. Configure telemetry with field-level redaction and alerts; restrict paid content.
5. Register domains through an organization account with MFA and registrar lock.
6. Create zone-scoped DNS automation identity; configure DNSSEC where supported.
7. Issue TLS certificates, set renewal/expiry alerts, and configure status/incident endpoints.
8. Manually approve the first production DNS and deployment changes.

### H. Billing and partners (later)

1. Create Stripe business account and complete verification.
2. Configure products/prices, tax treatment, webhook endpoint/signing secret, refunds, disputes,
   and customer portal.
3. Reconcile Stripe events idempotently; never use subscription webhooks to authorize wallets.
4. Define partner identity, attribution, double-entry credits, tax documentation, sanctions
   screening, settlement thresholds, and two-person payout approval.

## 7. Readiness gates

- **SDLC ready:** GitHub, workflow engine, isolated workers, evidence store, model policy,
  budgets, review separation, and doctor pass.
- **Payment sandbox ready:** D1–D8 approved, protocol conformance pass, client-wallet mode,
  testnet RPC/DEX, no production signer.
- **Mainnet canary ready:** appsec/QA evidence, legal approval, reconciliation, value caps,
  rollback/incident drill, named human approvers.
- **AI gateway ready:** separate runtime project, provider billing/retention, deterministic
  routing and payment enforcement, independent SLOs.
- **Inventory/Lightning ready:** separate legal approval, HSM/MPC, double-entry ledger,
  solvency/exposure controls, treasury ceremony, refund and incident runbooks.
