# The multi-agent system

An operator's guide. For the plan itself see [`MASTER_PLAN.md`](../MASTER_PLAN.md);
for the internals see [`orchestrator/README.md`](../orchestrator/README.md).

## The idea

AnyX splits along domain lines that barely overlap. Writing an EIP-712 signer
has almost nothing in common with tuning a Solidity fee calculation or writing
an LND gRPC client. Each needs different background and a different sense of
what "correct" means.

So each domain gets an agent that owns it, and an orchestrator coordinates them:
plan the work, dispatch it, verify the result, file the failures, fix what it
can, escalate what it cannot.

Three things make it safe to run unattended.

**Ownership is enforced.** Every agent declares its paths and the scheduler
refuses to run two agents whose paths overlap. Two agents editing one file in a
shared tree is how work gets lost.

**Acceptance is machine-checkable.** A task is done when its criteria pass — a
command exiting zero, a file existing, a file matching a pattern — not when an
agent says it is. Anything a machine cannot verify is marked `manual` and
requires a human.

**Autonomy is bounded.** Fixes are attempted a fixed number of times and then
escalated. Production deploys require explicit approval. Credentials are never
invented.

## The roster

| Agent | Domain |
| --- | --- |
| `orchestrator` | Planning, scheduling, coordination |
| `protocol` | x402 challenges, EIP-3009, facilitator client |
| `swap-routing` | DEX quotes, fee and spread maths, slippage |
| `contracts` | Solidity and Foundry |
| `backend` | API server, routes, middleware |
| `sdk` | `@anyx/sdk` |
| `data` | Schema, migrations, caching |
| `crosschain` | CCTP, Stargate, the float pool |
| `lightning` | LND, BOLT-11 invoices |
| `security` | Threat model, scanning, audit prep |
| `qa` | Test suites and coverage gates |
| `devops` | Docker, CI, deployment |
| `docs` | Guides, OpenAPI, `llms.txt` |
| `integrations` | LangChain, MCP, AgentKit |
| `growth` | Go-to-market execution |

```bash
./scripts/orchestrate agents            # the roster with task counts
./scripts/orchestrate agents protocol   # one agent in full
```

## Daily use

```bash
./scripts/orchestrate doctor      # is the machine ready?
./scripts/orchestrate plan        # what is ready, what is blocked and why
./scripts/orchestrate run         # dispatch and verify
./scripts/orchestrate status      # progress, open bugs, recent activity
./scripts/orchestrate report      # a markdown summary
```

`plan` is the one to reach for first. It names, for every blocked task, exactly
what it is waiting on — an unfinished dependency, a missing credential, an
uncleared manual gate.

### Scoping a run

```bash
./scripts/orchestrate run --phase 1              # one phase
./scripts/orchestrate run --task 1.2-quote-engine
./scripts/orchestrate run --concurrency 4
./scripts/orchestrate run --auto-fix             # fix failures in the same pass
./scripts/orchestrate run --dry-run              # render prompts, change nothing
```

`--dry-run` walks the entire graph in dependency order and writes every prompt
to `.orchestrator/prompts/` without touching durable state. It is the fastest
way to see what the system intends to do.

## Wiring up a real agent

Out of the box the executor is `dry-run`: it renders a prompt and stops. To let
tasks actually reach a coding agent:

```jsonc
// config/anyx.config.jsonc
"orchestrator": {
  "agentCommand": "your-agent --prompt-file {{promptFile}}"
}
```

Placeholders: `{{promptFile}}`, `{{taskId}}`, `{{agentId}}`, `{{repoRoot}}`. The
prompt also arrives on stdin. For an HTTP service, set `agentEndpoint` instead.

No provider is compiled in and no credential is stored in the orchestrator. It
only knows how to hand a prompt to a command or a URL.

Each dispatched prompt contains the agent's mission and domain rules, the task
brief and its dependencies, the exact owned paths, the acceptance criteria, the
verification commands that will be run, the required configuration, the git
discipline, and the definition of done. An agent is briefed identically whether
a human or the scheduler invokes it.

## When something breaks

Failures become bugs automatically. You can also look at them directly:

```bash
./scripts/orchestrate bugs list
./scripts/orchestrate bugs show bug-1a2b3c4d
./scripts/orchestrate bugs triage --ci     # also pull in failing CI runs
./scripts/orchestrate bugs fix             # run the auto-fix loop
./scripts/orchestrate bugs fix bug-1a2b3c4d
```

A bug carries its severity, owning domain, the triage rationale, the failing
command, the captured output, the implicated files, how many times it has been
seen and how many fixes have been attempted.

Anything can file one by dropping JSON into the inbox:

```bash
echo '{"title":"double settlement","error":"duplicate nonce accepted"}' \
  > .orchestrator/inbox/dup.json
./scripts/orchestrate bugs triage
```

When the auto-fix loop gives up, the bug is marked `needs-human` and
`.orchestrator/escalations/<bug>.md` has everything needed to reproduce it.

## Credentials

```bash
./scripts/orchestrate gates            # the checklist
./scripts/orchestrate gates --verify   # prove the ones you have actually work
```

A gate is something only a person can do. The orchestrator never tries to
satisfy one; it stops in front of it and prints what to paste where, why it is
needed, and which tasks it is blocking.

Full walkthrough: [`config/README.md`](../config/README.md).

## Adding an agent

1. Create `orchestrator/agents/<id>.agent.ts` exporting an `AgentDefinition`.
2. Add the id to `AGENT_IDS` in `orchestrator/shared/types.ts`.
3. Register it in `orchestrator/agents/index.ts`.
4. Give it tasks in `orchestrator/tasks/phase*.ts`.

Then `./scripts/orchestrate plan` — it validates the graph and names any
dangling dependency or cycle.

When choosing owned paths, make sure they do not overlap another agent's. The
scheduler will simply never run the two concurrently, which looks like an
inexplicable stall rather than an error.

## Automation

`.github/workflows/orchestrator.yml` runs on weekday mornings: the test gates,
then triage of anything that failed, then a report uploaded as an artifact. So a
failure that appeared overnight is already classified and assigned to a domain
before anyone opens the repository.

Automated fixing is opt-in via `workflow_dispatch`, and only does anything when
an executor is configured.
