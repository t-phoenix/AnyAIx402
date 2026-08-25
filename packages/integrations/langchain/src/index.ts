import { UPA, type UPAConfig } from "@anyx/sdk";

/** LangChain-compatible tool shape (no langchain runtime dependency in v0). */
export class AnyXPaymentTool {
  name = "anyx_pay_x402";
  description = `Pay for access to an x402-gated API endpoint using any cryptocurrency.
Input JSON: { "endpointUrl": "https://api.example.com/data", "inputToken": "ETH" }
Output: The API response data as a string.
Use this tool when you need to access a paid API or when you receive a 402 Payment Required error.
Supported tokens: ETH, USDT, WBTC, USDC, cbBTC. Handles swap and payment automatically.`;

  private upa: UPA;

  constructor(config: UPAConfig) {
    this.upa = new UPA(config);
  }

  async _call(input: string): Promise<string> {
    const parsed = JSON.parse(input) as { endpointUrl: string };
    const res = await this.upa.fetch(parsed.endpointUrl);
    return JSON.stringify(await res.json().catch(() => res.text()));
  }
}
