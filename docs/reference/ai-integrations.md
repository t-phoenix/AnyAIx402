  AnyX — AI Agent Integration Guide

AI Agent Integration Guide · August 2025

# AnyX for  
_AI Agents & LLM Frameworks_

How to integrate AnyX into LangChain, Coinbase AgentKit, CrewAI, AutoGen, ElizaOS, OpenAI Agents SDK, and any MCP-compatible client. Agents pay x402 APIs with ETH, USDT, or any token — automatically.

Overview

## Why AI Agents Need AnyX

AI agents that call paid x402 APIs today must hold USDC specifically on Base. This creates operational overhead: agents need separate USDC acquisition logic, treasury management in two tokens, and manual bridge operations when deployed on non-Base chains.

AnyX removes this requirement. An agent holding ETH, USDT, WBTC, or any token can call any x402 API directly. AnyX handles the swap and payment in one call.

**Integration takes ~10 lines of code in any framework.** The AnyX SDK exposes a drop-in `upa.fetch()` that behaves like native `fetch()` but automatically handles 402 responses by swapping and paying.

---

Integration 1

## LangChain

### @anyx/langchain

Phase 1 LangChain 95K+ GitHub stars

AnyX provides a LangChain Tool that agents can use to call any x402-gated endpoint with any token in their wallet.

```
// Installation
npm install @anyx/sdk @anyx/langchain

// Basic Tool Setup
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents'
import { AnyXPaymentTool } from '@anyx/langchain'
import { createWalletClient, http } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount(process.env.PRIVATE_KEY)
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
})

const anyxTool = new AnyXPaymentTool({
  wallet: walletClient,
  preferredToken: 'ETH',        // Agent pays with ETH
  preferredChainId: 8453,       // Base mainnet
  maxSlippage: 0.005,           // 0.5% max slippage
  apiKey: process.env.ANYX_API_KEY,
})

// Add to agent
const tools = [anyxTool, ...otherTools]
const agent = createToolCallingAgent({ llm, tools, prompt })
const executor = new AgentExecutor({ agent, tools })
```

The tool description is written for LLMs to understand when to use it:

```
// Tool description (auto-set in @anyx/langchain)
name: 'anyx_pay_x402'
description: `Pay for access to an x402-gated API endpoint using any cryptocurrency.
Input JSON: { "endpointUrl": "https://api.example.com/data", "inputToken": "ETH" }
Output: The API response data as a string.
Use this tool when you need to access a paid API or when you receive a 402 Payment Required error.
Supported tokens: ETH, USDT, WBTC, USDC, cbBTC. Handles swap and payment automatically.`
```

**When an agent calls a paid API, it works like this:**

```
// Agent task: "Get the latest Bitcoin price from the intel API"
// Agent calls: anyx_pay_x402({ endpointUrl: "https://intel.example.com/btc-price" })
// AnyX: swaps 0.0004 ETH → 1.00 USDC → x402 payment → returns { price: 65432.10 }
// Agent: "The current Bitcoin price is $65,432.10"
```

---

Integration 2

## Coinbase AgentKit

### @anyx/agentkit

Phase 1 Official Coinbase agent framework

AgentKit agents already have CDP wallets. AnyX extends them to pay x402 APIs from any token they hold — not just USDC.

```
import { AgentKit, CdpWalletProvider } from '@coinbase/agentkit'
import { ANYX_PAY_ACTION } from '@anyx/agentkit'

const walletProvider = await CdpWalletProvider.configureWithWallet({
  apiKeyName: process.env.CDP_API_KEY_NAME,
  apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
  networkId: 'base-mainnet',
})

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [
    // ... your existing actions
    ANYX_PAY_ACTION,  // <-- Add AnyX
  ],
})

// Agent can now call any x402 API with ETH, USDT, or WBTC
// AgentKit wallet holds ETH → AnyX converts to USDC → x402 settles
```

**Coinbase integration note:** AgentKit wallets are CDP-managed (custodial). AnyX works with these wallets by using the wallet's signing capability for EIP-3009 authorizations. The agent never needs to hold USDC.

---

Integration 3

## Model Context Protocol (MCP)

### @anyx/mcp-server

Phase 1 Works with Claude Code, Cursor, any MCP client

AnyX exposes an MCP server that gives any MCP-compatible client the ability to pay x402 APIs with any token. Works with Claude Code, Cursor Agent, and any other MCP host.

#### Installation

```
# Run standalone
npx @anyx/mcp-server

# Or add to your MCP config (claude_desktop_config.json / .cursor/mcp.json)
{
  "mcpServers": {
    "anyx": {
      "command": "npx",
      "args": ["@anyx/mcp-server"],
      "env": {
        "ANYX_API_KEY": "your_key",
        "ANYX_PREFERRED_TOKEN": "ETH",
        "ANYX_CHAIN_ID": "8453"
      }
    }
  }
}
```

#### Exposed MCP Tools

```
// Tool 1: anyx_quote
// Get a payment quote for an x402 endpoint
{
  "name": "anyx_quote",
  "description": "Get a price quote to pay for access to an x402-gated API with your preferred token (ETH, USDT, etc.)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "endpointUrl": { "type": "string", "description": "The x402-gated API URL" },
      "inputToken": { "type": "string", "description": "Token to pay with (ETH, USDT, WBTC)" }
    },
    "required": ["endpointUrl"]
  }
}

// Tool 2: anyx_pay
// Execute payment and return API response
{
  "name": "anyx_pay",
  "description": "Pay for access to an x402-gated API endpoint and return the response. Handles swap from your token to USDC automatically.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "endpointUrl": { "type": "string" },
      "quoteId": { "type": "string", "description": "Optional: use existing quote" }
    },
    "required": ["endpointUrl"]
  }
}

// Tool 3: anyx_supported_tokens
// List available tokens
{
  "name": "anyx_supported_tokens",
  "description": "List all tokens AnyX can accept as payment input, with current USD prices"
}
```

#### Example: Claude Code Using AnyX MCP

```
// User asks Claude: "Get me the on-chain risk score for contract 0xabc..."
// Claude detects the API is x402-gated (returns 402)
// Claude calls: anyx_pay({ endpointUrl: "https://contract-guard.example.com/risk/0xabc..." })
// AnyX swaps 0.02 USDT → 0.001 USDC → x402 payment
// Claude returns: "The contract risk score is 72/100 — moderate risk due to..."
```

---

Integration 4

## OpenAI Agents SDK

### Function Calling / Tool Definition

Phase 1

Use AnyX as an OpenAI function tool definition. The agent decides when to call x402 APIs and AnyX handles the payment.

```
import OpenAI from 'openai'
import { UPA } from '@anyx/sdk'

const upa = new UPA({ preferredToken: 'ETH', preferredChainId: 8453, wallet })

const tools = [
  {
    type: 'function',
    function: {
      name: 'call_paid_api',
      description: 'Call an x402-gated paid API endpoint. Handles cryptocurrency payment automatically using ETH. Use when you need data from a service that requires payment.',
      parameters: {
        type: 'object',
        properties: {
          endpoint_url: {
            type: 'string',
            description: 'The full URL of the paid API endpoint to call'
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST'],
            default: 'GET'
          },
          body: {
            type: 'string',
            description: 'JSON body for POST requests'
          }
        },
        required: ['endpoint_url']
      }
    }
  }
]

// Function executor
async function callPaidAPI({ endpoint_url, method = 'GET', body }) {
  const res = await upa.fetch(endpoint_url, {
    method,
    body: body ? JSON.parse(body) : undefined,
  })
  return JSON.stringify(await res.json())
}

// In your tool call handler:
if (toolCall.function.name === 'call_paid_api') {
  const args = JSON.parse(toolCall.function.arguments)
  const result = await callPaidAPI(args)
  // Add result to messages as tool response
}
```

---

Integration 5

## CrewAI

### Custom CrewAI Tool

Phase 1 CrewAI 25K+ GitHub stars

```
from crewai import Agent, Task, Crew
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
import requests

class AnyXPayInput(BaseModel):
    endpoint_url: str = Field(description="The x402-gated API endpoint URL")
    input_token: str = Field(default="USDT", description="Token to pay with: ETH, USDT, WBTC")

class AnyXPayTool(BaseTool):
    name: str = "anyx_pay_x402_api"
    description: str = (
        "Pay for and call an x402-gated API endpoint using cryptocurrency. "
        "Use this when accessing a paid API that requires micropayment. "
        "Handles USDT, ETH, WBTC payment automatically. "
        "Returns the API response data."
    )
    args_schema: type[BaseModel] = AnyXPayInput
    api_key: str = ""

    def _run(self, endpoint_url: str, input_token: str = "USDT") -> str:
        headers = {"X-API-Key": self.api_key} if self.api_key else {}

        # Get quote
        quote_res = requests.post(
            "https://api.anyx.xyz/v1/quote",
            json={"endpointUrl": endpoint_url, "inputToken": input_token, "inputChainId": 8453},
            headers=headers
        ).json()

        # Execute payment
        pay_res = requests.post(
            "https://api.anyx.xyz/v1/pay",
            json={"quoteId": quote_res["quoteId"], "walletAddress": "0xYourWallet"},
            headers=headers
        ).json()

        return str(pay_res.get("apiResponse", pay_res))

# Usage in CrewAI
anyx_tool = AnyXPayTool(api_key="your_anyx_key")

researcher = Agent(
    role="Crypto Researcher",
    goal="Gather on-chain intelligence about tokens",
    tools=[anyx_tool],
    verbose=True
)

task = Task(
    description="Get the risk score for contract 0x1234... using the ContractGuard API at https://contract-guard.example.com/risk",
    agent=researcher
)
```

---

Integration 6

## ElizaOS Plugin

### @anyx/eliza-plugin

Phase 2 ElizaOS — popular agent OS

ElizaOS uses a plugin architecture. AnyX publishes a plugin that adds multi-token x402 payment capability to any Eliza agent.

```
// In your Eliza agent character config:
import { anyxPlugin } from '@anyx/eliza-plugin'

export const myAgent: Character = {
  name: 'MyAgent',
  plugins: [
    anyxPlugin({
      preferredToken: 'ETH',
      chainId: 8453,
      apiKey: process.env.ANYX_API_KEY,
    }),
    // ... other plugins
  ],
  // ...
}

// Eliza will automatically handle requests like:
// "Fetch the latest whale movements from that paid on-chain API"
// → AnyX plugin intercepts the x402 response → pays with ETH → returns data
```

---

Integration 7

## AutoGen (Microsoft)

### AutoGen Function Tool

Phase 1 Microsoft AutoGen framework

```
from autogen import ConversableAgent, register_function
import httpx

async def anyx_pay_x402(endpoint_url: str, input_token: str = "ETH") -> str:
    """
    Pay for and call an x402-gated API endpoint.

    Args:
        endpoint_url: The URL of the paid API to call
        input_token: Cryptocurrency to pay with (ETH, USDT, WBTC)

    Returns:
        The API response as a string
    """
    async with httpx.AsyncClient() as client:
        # Quote
        quote = (await client.post("https://api.anyx.xyz/v1/quote", json={
            "endpointUrl": endpoint_url,
            "inputToken": input_token,
            "inputChainId": 8453
        })).json()

        # Pay
        result = (await client.post("https://api.anyx.xyz/v1/pay", json={
            "quoteId": quote["quoteId"],
            "walletAddress": "0xYourWallet"
        })).json()

        return str(result.get("apiResponse"))

# Register with AutoGen agent
assistant = ConversableAgent("assistant", llm_config={"config_list": config_list})
user_proxy = ConversableAgent("user_proxy", human_input_mode="NEVER")

register_function(
    anyx_pay_x402,
    caller=assistant,
    executor=user_proxy,
    name="anyx_pay_x402",
    description="Pay for access to an x402-gated API using ETH or USDT. Use when calling paid APIs."
)
```

---

Best Practices

## Best Practices for Agent Integration

### 1\. Always Configure a Budget Cap

```
const upa = new UPA({
  preferredToken: 'ETH',
  maxMonthlySpendUSD: 50,    // Agent won't spend more than $50/month
  maxPerCallSpendUSD: 2,     // Reject any call costing more than $2
  wallet: walletClient,
})
```

### 2\. Log All Payments for Audit

```
upa.on('payment', (receipt) => {
  logger.info({
    event: 'x402_payment',
    endpoint: receipt.endpoint,
    inputToken: receipt.inputToken,
    inputAmount: receipt.inputAmount,
    usdcCost: receipt.usdcSettled,
    txHash: receipt.txHash,
  })
})
```

### 3\. Handle Payment Errors Gracefully

```
try {
  const res = await upa.fetch(endpoint)
  return await res.json()
} catch (err) {
  if (err.code === 'INSUFFICIENT_BALANCE') {
    return 'I cannot access this paid API — insufficient token balance.'
  }
  if (err.code === 'SWAP_FAILED') {
    return 'Payment routing failed. Try again or use a different token.'
  }
  throw err
}
```

### 4\. Quote Before High-Value Calls

```
// Show cost estimate before paying (good UX for human-in-the-loop agents)
const quote = await upa.quote(endpoint)
if (parseFloat(quote.inputAmountUSD) > 1.00) {
  const confirm = await askHuman(`This will cost ~$${quote.inputAmountUSD}. Proceed?`)
  if (!confirm) return 'Payment cancelled.'
}
const res = await upa.fetch(endpoint, { useQuote: quote })
```

**Token selection guidance for agents:** For agents that call many small APIs ($0.001–$0.01 each), USDT→USDC offers the lowest spread (0.05%). For agents with larger ETH treasuries making fewer, larger calls, ETH is simplest. BTC Lightning is reserved for agents explicitly serving Bitcoin-native users.

AnyX AI Agent Integration Guide — August 2025 — docs.anyx.xyz/agents