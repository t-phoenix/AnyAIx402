# AnyAIx402 — Universal Multi-Token Payment Adapter & Multi-Agent Orchestrator

AnyAIx402 is an autonomous multi-agent architecture and universal payment adapter for the x402 machine-to-machine payment protocol. It enables any AI agent, dApp, or user holding any cryptocurrency (ETH, USDT, WBTC, SOL, APT on Aptos, or BTC via Lightning) to settle HTTP 402 payment challenges seamlessly while generating a transparent 0.05%–0.75% swap spread.

---

## 🌟 Key Features

1. **Domain-Specialized Multi-Agent System**:
   - **Move / Aptos Specialist Agent**: Move smart contract generation, Aptos coin transfer security, fee extraction, and test suites.
   - **EVM Solidity Specialist Agent**: Solidity 0.8.24 router contracts (`AnyXRouter.sol`), Permit2, and Foundry tests.
   - **x402 Protocol Specialist Agent**: HTTP 402 challenge parsing, EIP-3009 `transferWithAuthorization` signing, and facilitator failover.
   - **Cross-Chain Bridge Specialist Agent**: Circle CCTP v2 burn/mint routing, Solana/Aptos bridging, and ReservePool float management.
   - **AI & LLM Integration Agent**: LangChain tool definitions, Model Context Protocol (MCP) server endpoints, and Coinbase AgentKit actions.
   - **QA & Test Automation Agent**: Automated test execution, cryptographic signature verification, and regression prevention.
   - **Security Audit Agent**: Static analysis, reentrancy audits, slippage vulnerability mitigation, and key handling reviews.
   - **DevOps & Deployment Agent**: Automated smart contract and API service deployment pipelines.
   - **Bug Reporter & Auto-Fixer Agent**: Real-time error interception, structured triage, automated patch suggestion, and verification.

2. **Automated Multi-Agent Orchestrator**:
   - End-to-end task dispatching, automatic bug triage and auto-remediation, QA test execution, and deployment verification.

3. **User-Friendly Configuration & Manual Integration System**:
   - Exposes all external API key and payment connectivity requirements (1inch, 0x, Aptos/Base private keys, Lightning LND, Stripe, AI LLMs) via `.env` and `/v1/config/requirements`.

---

## 📁 Repository Structure

```
.
├── docs/                               # Project whitepaper, PRDs, monetization, GTM, and research docs
├── src/
│   ├── agents/
│   │   └── specializedAgents.ts        # 9 Domain-specialized AI agents
│   ├── config/
│   │   └── index.ts                    # Zod-validated configuration & manual config inspector
│   ├── contracts/
│   │   ├── AnyXRouter.sol              # EVM Solidity multi-token router
│   │   └── aptos/                      # Aptos Move package
│   │       ├── Move.toml
│   │       └── sources/
│   │           └── AnyXRouter.move     # Move router module
│   ├── core/
│   │   ├── tokens.ts                   # Universal Token Registry (Base, Aptos, Eth, Sol, BTC LN)
│   │   ├── types.ts                    # x402 challenge & payment types
│   │   ├── quote.ts                    # DEX aggregation quote engine
│   │   └── eip3009.ts                  # EIP-3009 TransferWithAuthorization signer
│   ├── orchestrator/
│   │   ├── index.ts                    # Multi-Agent Orchestrator engine
│   │   └── cli.ts                      # Interactive CLI runner
│   ├── types/
│   │   └── agent.ts                    # Agent, task, bug report, and deployment types
│   └── index.ts                        # Express / REST API server
├── tests/                              # Automated test suites
├── .env.example                        # Template for easy user configuration
├── package.json
└── tsconfig.json
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your API keys, private keys, or payment credentials as required. To inspect configuration needs programmatically, query `GET /v1/config/requirements`.

### 3. Run Automated Multi-Agent Orchestrator
```bash
npm run orchestrator
```

### 4. Run Test Suites
```bash
npm test
```

### 5. Start REST API Server
```bash
npm start
```
The server will start on `http://localhost:3000`.

---

## 🔌 API Endpoints

- `GET /health` — Service health check
- `GET /v1/orchestrator/status` — Orchestrator status & registered agents
- `GET /v1/config/requirements` — Configured vs missing manual API/payment settings
- `POST /v1/orchestrator/dispatch` — Dispatch a task to any specialized agent
- `POST /v1/orchestrator/report-bug` — Automated bug reporting & auto-fix trigger
- `GET /v1/orchestrator/bugs` — List all triaged/fixed bug reports
- `POST /v1/orchestrator/run-tests` — Trigger automated QA test suite
- `POST /v1/orchestrator/deploy` — Trigger automated deployment pipeline
- `GET /v1/tokens` — List supported tokens and swap paths
- `POST /v1/quote` — Request an x402 payment quote for any token
- `POST /v1/pay` — Settle an x402 payment
