# The AnyX orchestrator

A multi-agent build system: it plans the work, hands each task to the specialist
agent that owns that domain, verifies the result, turns failures into
deduplicated bug reports, tries to fix them, and deploys what passes.

It has **no dependencies**. Everything here runs on Bun and Node built-ins,
which is deliberate — the orchestrator has to be able to bootstrap a repository
in which `bun install` has never been run. CI verifies this by running it before
installing anything.

```bash
./scripts/orchestrate doctor    # is this machine ready?
./scripts/orchestrate gates     # what does a human still have to supply?
./scripts/orchestrate plan      # what is ready to run?
./scripts/orchestrate run --dry-run
```

Nothing is dispatched until you configure an executor, so all of the above are
safe on a fresh clone.

---

## Architecture

```
                         ┌─────────────────────────┐
                         │      cli.ts             │
                         │  plan run status bugs   │
                         │  test deploy gates ...  │
                         └────────────┬────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐            ┌────────────────┐           ┌──────────────────┐
│    tasks/     │            │     core/      │           │    pipelines/    │
│               │            │                │           │                  │
│ 31 tasks as   │───────────►│  scheduler     │           │  test.ts         │
│ a dependency  │            │  runner        │           │  deploy.ts       │
│ DAG, phases   │            │  dispatcher    │           │  report.ts       │
│ 0-7 + ci      │            │  verifier      │           │                  │
└───────────────┘            │  state/events  │           └────────┬─────────┘
        ▲                    └───────┬────────┘                    │
        │                            │                             │
┌───────┴───────┐                    │                             │
│    agents/    │                    ▼                             │
│               │           ┌──────────────────┐                   │
│ 15 specialist │           │   executors/     │                   │
│ definitions,  │           │                  │                   │
│ owned paths,  │           │  dry-run (dflt)  │                   │
│ domain rules  │           │  shell           │                   │
└───────────────┘           │  http            │                   │
                            └──────────────────┘                   │
┌───────────────┐                    │                             │
│    config/    │                    ▼                             │
│               │           ┌──────────────────┐                   │
│ loader with   │           │      bugs/       │◄──────────────────┘
│ precedence,   │──────────►│                  │
│ manual gates  │           │  intake          │
└───────────────┘           │  fingerprint     │
                            │  triage          │
                            │  fixLoop         │
                            │  store           │
                            └──────────────────┘
                                     │
                                     ▼
                         .orchestrator/  (git-ignored)
                         state.json  events.jsonl  bugs.json
                         logs/  prompts/  inbox/
                         escalations/  reports/
```

| Directory | Responsibility |
| --- | --- |
| `agents/` | One definition per domain: mission, owned paths, capabilities, required gates, definition of done, domain rules |
| `tasks/` | The build graph, phase by phase, with dependencies and machine-checkable acceptance criteria |
| `core/` | Scheduling, dispatch, verification, durable state, the append-only event log, executors |
| `bugs/` | Intake, fingerprinting, triage, the bounded auto-fix loop, escalation |
| `pipelines/` | Staged test gates, environment-aware deploys, markdown reporting |
| `config/` | Configuration loading with precedence, and the manual gate registry |
| `cli/` | Argument parsing and terminal formatting |

---

## The agents

| Id | Name | Owns |
| --- | --- | --- |
| `orchestrator` | Orchestrator | `orchestrator/`, `.github/`, `scripts/` |
| `protocol` | Protocol Engineer | `core/src/x402.ts`, `eip3009.ts`, `facilitator.ts` |
| `swap-routing` | Swap Routing Engineer | `core/src/quote.ts`, `swap.ts`, `tokens.ts`, `fees.ts` |
| `contracts` | Smart Contract Engineer | `packages/contracts/` |
| `backend` | Backend Engineer | `apps/api/` |
| `sdk` | SDK Engineer | `packages/sdk/` |
| `data` | Data Engineer | `packages/db/` |
| `crosschain` | Cross-Chain Engineer | `core/src/bridge/` |
| `lightning` | Lightning Engineer | `apps/lightning/` |
| `security` | Security Engineer | `security/` |
| `qa` | QA Engineer | `tests/`, `__tests__/` |
| `devops` | DevOps Engineer | compose files, `Dockerfile`, `fly.toml` |
| `docs` | Documentation Engineer | `apps/docs/`, `docs/` |
| `integrations` | Integrations Engineer | `packages/integrations/` |
| `growth` | Growth Engineer | `growth/` |

`./scripts/orchestrate agents <id>` prints one in full.

**Ownership is enforced, not suggested.** The scheduler will not run two agents
whose ownership globs intersect, because two agents editing the same file in one
working tree is how you lose work.

### Adding an agent

1. Add `orchestrator/agents/<id>.agent.ts` exporting an `AgentDefinition`.
2. Add the id to `AGENT_IDS` in `orchestrator/shared/types.ts`.
3. Register it in `orchestrator/agents/index.ts`.
4. Give it tasks in `orchestrator/tasks/phase*.ts`.

`./scripts/orchestrate plan` validates the result and names any dangling
dependency or cycle.

---

## The bug lifecycle

**Intake.** Six adapters feed it: failed verification commands, failed
acceptance criteria, test transcripts (individual failing test names are pulled
out of Vitest and `bun test` output), typecheck, lint, GitHub Actions logs via
`gh run view --log-failed`, and runtime reports written as JSON into
`.orchestrator/inbox/`.

Anything can report a bug by dropping a file in the inbox:

```bash
echo '{"title":"payment settled twice","error":"duplicate nonce","files":["packages/core/src/eip3009.ts"]}' \
  > .orchestrator/inbox/dup-nonce.json
./scripts/orchestrate bugs triage
```

**Fingerprint.** Timestamps, durations, hex addresses, hashes, line and column
numbers and absolute paths are stripped before hashing. The same failure yields
the same fingerprint on a different machine on a different day, so a recurring
failure increments a counter rather than filling the store with duplicates.

**Triage.** Deterministic, so the same failure always reaches the same
specialist. Content signatures route by meaning — slippage and `minAmountOut` to
`swap-routing` at critical severity, `transferWithAuthorization` to `protocol`,
CCTP and float to `crosschain`. For lint and typecheck the *file paths* are
authoritative instead: a whole-repo lint transcript quotes unrelated source, and
a line that happens to contain the word "slippage" must not turn a formatting
failure into a critical payment bug.

Override any of it by regex:

```jsonc
"orchestrator": {
  "bugs": {
    "triageOverrides": [
      { "pattern": "flaky-e2e", "agentId": "qa", "severity": "low" }
    ]
  }
}
```

**Auto-fix.** The bug becomes a synthetic task carrying the failing command, the
captured output and the implicated files, dispatched to its owning agent. Then
the original failing command is re-run — the fix is proven by the same check
that caught the problem. Bounded attempts (default 3) with exponential backoff.

The fix prompt explicitly forbids silencing the check, loosening a threshold,
deleting the failing test or marking it skipped. An agent that believes the
check itself is wrong is told to say so rather than change it quietly.

**Escalate.** On exhaustion, the bug is marked `needs-human` and
`.orchestrator/escalations/<bug>.md` gets the command, the output, the files,
the triage rationale and every attempt. A GitHub issue body is drafted
alongside; creating the issue requires `bugs.createGithubIssues` and is never
implicit.

---

## Test gates

```bash
./scripts/orchestrate test                          # stop at the first failure
./scripts/orchestrate test --continue               # collect everything in one pass
./scripts/orchestrate test --stage lint,typecheck   # just these
./scripts/orchestrate test --no-bugs                # report only, file nothing
```

| Stage | Default command | Skipped when |
| --- | --- | --- |
| lint | `bun run lint` | no `lint` script |
| typecheck | `bun run typecheck` | no `typecheck` script |
| unit | `bun test` | no `test` script |
| integration | `bun run test:integration` | no such script |
| contracts | `forge test -vvv` | `forge` not installed |
| coverage | `bun test --coverage` | no `test` script |

A skip is reported with its reason and does not fail the gate. An incomplete
monorepo is expected, not exceptional.

---

## Deploying

```bash
./scripts/orchestrate deploy local
./scripts/orchestrate deploy staging
./scripts/orchestrate deploy production --approve
./scripts/orchestrate deploy production --dry-run
```

Per environment: preflight gate validation → approval → build → deploy →
migrate → health check → rollback on failure.

**Production refuses to deploy without `--approve`.** Nothing in an autonomous
loop should be able to ship to production on its own. If a release never becomes
healthy, the rollback command runs automatically before the pipeline reports
failure.

---

## Executors

The orchestrator does not know or care which coding agent is on the other end.

| Kind | Configure with | Behaviour |
| --- | --- | --- |
| `dry-run` | *(default)* | Renders the prompt to `.orchestrator/prompts/`, invokes nothing |
| `shell` | `orchestrator.agentCommand` | Runs a command per task; prompt on stdin and at `{{promptFile}}` |
| `http` | `orchestrator.agentEndpoint` | POSTs the prompt to an endpoint |

```jsonc
"orchestrator": {
  "agentCommand": "your-agent --prompt-file {{promptFile}}"
}
```

Placeholders: `{{promptFile}}`, `{{taskId}}`, `{{agentId}}`, `{{repoRoot}}`.

Setting either field switches away from dry-run. If a kind is selected but not
configured, it falls back to dry-run and says why rather than failing.

---

## Configuration

Precedence, strongest first: `process env` → `.env.local` → `.env` →
`config/anyx.config.jsonc` → built-in defaults.

Useful environment overrides: `ANYX_EXECUTOR`, `ANYX_EXECUTOR_COMMAND`,
`ANYX_EXECUTOR_URL`, `ANYX_CONCURRENCY`, `ANYX_MAX_FIX_ATTEMPTS`,
`ANYX_SKIP_GATES`, `ANYX_COVERAGE_THRESHOLD`, `ANYX_RUNTIME_DIR`,
`ANYX_CREATE_GITHUB_ISSUES`, `ANYX_DEBUG=1` for stack traces.

`./scripts/orchestrate config` prints everything resolved, with secrets masked.

### Manual gates

A gate is something only a person can do: create an account, fund a wallet,
provision a node. The orchestrator never tries to satisfy one — it stops in
front of it and prints exactly what to paste where.

```bash
./scripts/orchestrate gates             # the checklist
./scripts/orchestrate gates --verify    # prove the credentials you have work
```

Fifteen gates are registered, covering RPC endpoints, DEX keys, the x402
facilitator, the signing key, Postgres, Redis, the USDC float, LND, Stripe,
Basescan, Fly.io and npm. Each declares why it is needed, which tasks it blocks,
where to sign up, the steps to obtain it, and a command that proves it works.

The full operator walkthrough is in [`config/README.md`](../config/README.md).

---

## Runtime state

Everything lives in `.orchestrator/` (git-ignored, and it also writes its own
`.gitignore` containing `*` so it cannot be committed by accident).

| Path | Contents |
| --- | --- |
| `state.json` | Task statuses, attempt counts, run history. Written atomically. |
| `events.jsonl` | Append-only log of every state transition |
| `bugs.json` | The bug store |
| `logs/<taskId>/` | Verification stdout, stderr and exit codes |
| `prompts/` | Every dispatched prompt, exactly as sent |
| `inbox/` | Drop JSON here to report a runtime error |
| `escalations/` | Reproduction reports for bugs needing a human |
| `reports/` | Markdown run reports |

State is written via a temporary file and a rename, so an interrupt cannot
truncate it. `./scripts/orchestrate resume` picks up an interrupted run.

A dry run never marks a task complete in durable state — it tracks progress in
memory so it can still walk the whole graph, while `state.json` keeps telling
the truth about what has actually been built.

---

## GitHub Actions

| Workflow | Trigger | Notes |
| --- | --- | --- |
| `ci.yml` | PR, push to main | Lint, typecheck, test, build; orchestrator self-check; contracts (`continue-on-error`); secret scan (not) |
| `orchestrator.yml` | Weekday schedule, manual | Runs the gates, triages failures, uploads the report |
| `deploy-api.yml` | Push to main, manual | Skips cleanly without `FLY_API_TOKEN` |
| `publish-sdk.yml` | `v*` tag | Skips cleanly without `NPM_TOKEN` |

Secrets: `FLY_API_TOKEN`, `NPM_TOKEN`, `BASESCAN_API_KEY`, `DATABASE_URL`,
`REDIS_URL`, `ONEINCH_API_KEY`, `ZEROX_API_KEY`. Every job that needs one skips
with a notice when it is absent, so a fork never shows a red X for a credential
it was never going to have.

---

## Tests

```bash
bun test orchestrator
```

Covers topological ordering and cycle detection, readiness evaluation, bug
fingerprint stability and collision, triage determinism and the lint
false-positive case, configuration precedence across all four layers, and gate
evaluation.
