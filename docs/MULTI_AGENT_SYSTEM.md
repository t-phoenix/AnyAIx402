# Multi-agent engineering system

Status: proposed build-time SDLC architecture. This system does not authorize payments or run
the product.

## 1. Boundary and principles

Two meanings of “agent” must remain separate:

- **Build-time engineering agents** plan, edit, test, review, and prepare releases in isolated
  repositories. They operate under this document.
- **Runtime product agents** are customer-controlled callers that may use the AnyX SDK. They
  receive no engineering-control-plane credentials.

Payment parsing, amount arithmetic, policy, model routing, identity, state transitions,
settlement, ledger posting, release policy, and rollback are deterministic services. LLMs may
propose plans or patches but cannot be the system of record or approve their own work.

The orchestrator has a GitHub-native edge for issues, PRs, checks, and human interaction, backed
by a durable Temporal-style control plane. Workers are ephemeral and isolated. Every command,
result, artifact, approval, and state transition is attributable and replayable.

## 2. Components

| Component | Responsibility |
| --- | --- |
| GitHub intake | Receive issues, labels, comments, checks, and approval events |
| Intake normalizer | Verify provenance; redact secrets; classify repo, risk, and intent |
| Durable workflow engine | Persist state, timers, retries, signals, cancellation, compensation |
| Policy engine | Evaluate permissions, budgets, risk class, required reviewers and environments |
| Planner worker | Produce scoped tasks, dependencies, tests, and decision requests |
| Implementation workers | Modify code/docs in one isolated branch/worktree each |
| Test workers | Execute deterministic checks in fresh environments |
| Review worker | Read-only correctness/maintainability review |
| AppSec worker | Independent read-only threat/dependency/secret review |
| QA worker | Independent read-only acceptance and regression verification |
| Release coordinator | Build immutable artifacts and staged release candidate |
| Deployment controller | Apply approved releases, canary, rollback, and evidence capture |
| Evidence store | Content-addressed logs, reports, manifests, approvals, and provenance |
| Incident workflow | Detect, contain, communicate, roll back, preserve evidence, follow up |

No implementation worker may act as final reviewer, security reviewer, or QA approver for its
own task.

## 3. Roles and permission envelopes

### Product/architecture roles

- **Lead architect:** resolves boundaries, interfaces, state invariants, and ADR dependencies.
- **Product analyst:** verifies user value, requirements, traceability, and economic arithmetic.
- **Protocol specialist:** owns x402 conformance fixtures and compatibility reports.
- **Payments/security architect:** owns custody, signing, wallet, ledger, and threat models.

### Delivery roles

- **SDK agent:** protocol client, replay, policy hooks, wallet adapters.
- **Routing agent:** quote normalization, DEX adapters, fee/slippage arithmetic.
- **Platform agent:** orchestration, receipt journal, API, metering, observability.
- **AI gateway agent:** only if D1 approves inference scope; model-provider adapters and routing.
- **Infrastructure agent:** CI, build images, environments, deployment definitions.
- **Documentation agent:** contracts, guides, decision logs, operational runbooks.

### Independent assurance roles

- **Code reviewer:** read-only source/diff; cannot push or approve deployment.
- **AppSec reviewer:** read-only source, SBOM, threat model, scans; can block.
- **QA verifier:** fresh environment; acceptance tests only; can block.
- **Release approver:** validates evidence; cannot change source.
- **Treasury/security approver:** human-only for high-risk production operations.

Credentials are short-lived, workload-bound, repository/environment scoped, and least
privileged. Workers receive secret references resolved just-in-time, never configuration values
or broad cloud/GitHub tokens.

## 4. Versioned contracts

All messages use JSON Schema and carry:

```text
schemaVersion, contractType, contractVersion, workflowId, taskId, attempt,
repository, baseCommit, actor, createdAt, correlationId, idempotencyKey
```

### `TaskSpec/v1`

Required fields:

- `intent`, `sourceIssue`, `scope.include`, `scope.exclude`
- `requirements[]` with stable IDs and source references
- `dependencies[]`, `riskClass`, `dataClassification`
- `allowedPaths[]`, `forbiddenPaths[]`, `allowedTools[]`
- `baseBranch`, `branchName`, `worktreeId`
- `acceptanceChecks[]`, `requiredArtifacts[]`
- `budgets` for tokens, wall-clock, compute, commands, changed files, and cost
- `approvalPolicy`, `retryPolicy`, `deadline`

### `PlanResult/v1`

Contains assumptions, questions, change graph, file ownership, test strategy, migrations,
rollout/rollback, expected evidence, and an explicit `ready | blocked | rejected` outcome.

### `ImplementationResult/v1`

Contains base/final commit, changed files, requirement mapping, commands, tests, generated
artifacts, known limitations, and machine-readable handoff. It cannot claim review approval.

### `Finding/v1`

Contains fingerprint, category, severity, confidence, file/range, invariant violated, evidence,
reproduction, suggested remediation, owner, and status. Fingerprint is computed from normalized
rule, component, location, and causal signature.

### `VerificationResult/v1`

Contains check ID, environment digest, commit, status, logs/artifacts, flaky-test evidence, and
requirement coverage. Results from a different commit are invalid.

### `ReleaseCandidate/v1`

Contains commit, artifact digests, SBOM, provenance, signatures, compatibility matrix, migration
plan, rollout policy, rollback target, evidence bundle digest, and approvals.

Contracts are backward-compatible within a major version. Unknown major versions are rejected,
not guessed. Schema migrations are deterministic and recorded.

## 5. Durable workflow state machine

```text
received
  → normalized
  → triaged
  → planning
  → decision_wait (optional)
  → approved_for_build
  → implementing
  → testing
  → review
  → remediation (max 3 loops)
  → release_candidate
  → approval_wait
  → staging
  → canary
  → production
  → monitoring
  → completed
```

Terminal alternatives are `rejected`, `duplicate`, `cancelled`, `budget_exhausted`,
`blocked_external`, `security_blocked`, `failed`, and `rolled_back`.

Transitions require schema-valid inputs and policy predicates. Workflow history is append-only.
Signals handle human decisions and external events; timers handle deadlines and observation
windows. Activities may retry transient failures, but side effects require operation-specific
idempotency keys. Compensation is explicit: close superseded checks, revoke temporary
credentials, delete ephemeral workers, and roll back deployments; never rewrite history.

## 6. Issue intake and deduplication

1. Verify webhook signature and installation/repository identity.
2. Store immutable raw event; generate normalized, secret-redacted intake.
3. Reject prompt-injection instructions attempting to exceed repository policy.
4. Classify request type, subsystem, risk, affected paths, dependencies, and decision needs.
5. Compute duplicate candidates from:
   - repository and normalized intent;
   - affected symbols/paths;
   - stack traces and failing check IDs;
   - finding fingerprints;
   - linked issue/PR ancestry.
6. A deterministic threshold marks exact duplicates; uncertain semantic matches require planner
   or human confirmation. Never auto-close based only on embedding similarity.
7. Link duplicates to one canonical workflow while retaining reporters and evidence.

Bug reports must include observed/expected behavior, environment/commit, minimal reproduction,
logs with redaction, frequency, impact, regression range if known, and a stable fingerprint.

## 7. Planning and task graph

The planner reads authoritative docs, accepted ADRs, repository state, issue evidence, and
ownership policy. It emits a DAG of narrow tasks with explicit interfaces and acceptance checks.
The architect checks:

- product boundary and decision prerequisites;
- state/data migrations and compatibility;
- custody/security implications;
- file ownership collisions;
- rollout and recovery;
- whether implementation is authorized.

Tasks are parallel only when path ownership and contracts do not conflict. Contract/schema work
lands before consumers. A task blocked by a product decision enters `decision_wait`; it is not
resolved by agent inference.

## 8. Branch, worktree, and worker isolation

- One workflow integration branch; one short-lived task branch/worktree per implementation task.
- Worktrees start from the recorded immutable base commit.
- Workers run as unprivileged users in disposable containers/VMs with read-only base checkout,
  writable worktree, CPU/memory/time/process quotas, and restricted egress.
- Generated artifacts go to a task-specific directory and content-addressed evidence store.
- No shared mutable dependency cache for untrusted builds.
- Path ownership is enforced before commit. Overlap triggers serialization or replanning.
- Integration uses commit-based merges/cherry-picks after task checks; merge conflicts return to
  the owning task rather than being silently resolved by another agent.
- Force-push, history rewrite, direct default-branch writes, and unreviewed generated binaries
  are prohibited.

## 9. Implementation, tests, and fix loops

Implementation workers:

1. Revalidate base commit and task contract.
2. Make only authorized changes.
3. Add tests with implementation.
4. Run scoped deterministic checks.
5. Commit a logical change and produce `ImplementationResult`.

Fresh test workers then run formatting, lint, type checks, unit/property tests, contract tests,
integration/end-to-end tests, migrations, compatibility, secret/dependency/license scans, and
artifact reproducibility as applicable.

A failed check creates normalized `Finding` records. Duplicates are coalesced by fingerprint.
The owning implementation worker may perform at most **three remediation loops**:

`findings → causal plan → patch → fresh verification`

The loop counter is workflow-persistent and cannot be reset by spawning a worker. Repeated or
oscillating findings, scope expansion, budget exhaustion, or a third failed loop escalates to a
human with all attempts and diffs. Flaky tests are quarantined only through explicit policy and
an owned follow-up; retrying until green is forbidden.

## 10. Independent review

Review starts only on a fixed commit:

- **Code review:** correctness, invariants, maintainability, API compatibility, tests.
- **AppSec:** trust boundaries, auth, SSRF, injection, secrets, dependencies, signing, calldata,
  allowances, custody, and data retention.
- **QA:** requirement-level acceptance in a clean environment and exploratory failure paths.

Each role emits separate signed results. The implementer cannot dismiss a blocker; disputes go
to the architect/security owner. Any source change invalidates prior review and reruns impacted
checks. For payment, identity, deployment, or ledger code, two-person human approval is required
by policy even when automated reviews pass.

## 11. Release and deployment

1. Release coordinator builds once from the reviewed commit.
2. Produce signed immutable images/packages, SBOM, provenance, checksums, migration bundle, and
   evidence manifest.
3. Deploy the same digest to an ephemeral environment, then staging.
4. Run smoke, synthetic payment, compatibility, security, migration, and rollback tests.
5. Obtain required human production/security/treasury approvals.
6. Canary by tenant/traffic/value cap; do not rebuild between stages.
7. Compare error rate, latency, payment completion, duplicate attempts, reconciliation,
   dependency health, and business guardrails against baseline.
8. Promote progressively or automatically stop/roll back on deterministic thresholds.
9. Observe for the configured window before completion.

Database changes use expand/migrate/contract. Destructive contraction requires a later release
and human approval. Rollback must account for schema compatibility and irreversible external
side effects; payment reconciliation may require forward repair rather than transaction reversal.

## 12. Monitoring and incidents

Telemetry includes workflow/task IDs, commit and artifact digest, deployment, dependency
segment, payment operation IDs, and redacted error categories. Never log prompts containing
secrets, wallet keys, payment signatures, cookies, paid content, or raw model/provider payloads
without an approved retention policy.

Incident workflow:

1. Alert creates a fingerprinted incident and freezes conflicting deployments.
2. Deterministic automation contains traffic/value or rolls back when safe.
3. Human incident commander is paged for security, funds, treasury, privacy, or prolonged SLO
   impact.
4. Preserve logs, manifests, approvals, deployment events, and reconciliation snapshots.
5. Rotate/revoke credentials when implicated.
6. Communicate from approved templates.
7. Produce causal analysis, corrective tasks, and control updates; do not let the implementation
   agent close its own incident.

## 13. Budgets and escalation

Configured limits cover:

- workflow and task wall-clock;
- LLM tokens/cost and model allowlist;
- worker CPU, memory, storage, processes, and network;
- command count and output size;
- changed files/lines;
- remediation loops;
- concurrent workers;
- deployment traffic and value at risk.

Budget exhaustion pauses safely and requests human action. It never silently downgrades security
checks or selects a cheaper model for an incompatible task.

Mandatory escalation includes unclear product/custody decisions, unauthorized path changes,
schema major-version conflict, real secrets, destructive migration, production/security/treasury
operation, critical/high finding, suspected compromise, legal ambiguity, repeated test failure,
and any request to bypass controls.

## 14. Human approval matrix

| Action | Required human authority |
| --- | --- |
| Product boundary or accepted ADR | Product owner + lead architect |
| Custody/signing/ledger design | Security owner + payments owner |
| Critical/high risk waiver | Security owner; expiry and compensating controls required |
| Production deployment | Service owner |
| Value-moving production change | Service owner + security owner |
| Treasury funding/limit/withdrawal | Two treasury approvers |
| Signer creation/rotation/recovery | Security + treasury, separated operators |
| Destructive migration | Data owner + service owner |
| Legal/compliance boundary | Designated counsel/compliance owner |
| Emergency rollback | Incident commander; retrospective approval record |

Approvals bind workflow, commit, artifact digest, environment, action, expiry, and approver
identity. A generic PR approval cannot authorize treasury or signer actions.

## 15. Configuration

One schema-validated [`.anyx/sdlc.yaml`](CONFIGURATION_AND_MANUAL_SETUP.md#sample-anyxsdlcyaml)
defines repository policy, contracts, workers, checks, budgets, approvals, release stages, and
secret references. Repository config may tighten organization policy but cannot weaken it.
Unknown keys, inline secrets, unresolved references, and incompatible schema versions fail
closed.
