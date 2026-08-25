const CAIP2_PATTERN = /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/;
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ERC20_CAIP19_PATTERN = /^(eip155:[0-9]+)\/erc20:(0x[0-9a-fA-F]{40})$/;

export type Caip2Id = `${string}:${string}`;
export type Caip19Id = `${Caip2Id}/${string}:${string}`;

export function parseCaip2(value: string): Caip2Id {
  if (!CAIP2_PATTERN.test(value)) {
    throw new TypeError(`Invalid CAIP-2 network: ${value}`);
  }
  return value as Caip2Id;
}

export function parseEvmAddress(value: string): `0x${string}` {
  if (!EVM_ADDRESS_PATTERN.test(value)) {
    throw new TypeError(`Invalid EVM address: ${value}`);
  }
  return value.toLowerCase() as `0x${string}`;
}

export function erc20Caip19(network: Caip2Id, address: string): Caip19Id {
  if (!network.startsWith("eip155:")) {
    throw new TypeError(`ERC-20 asset requires an eip155 network: ${network}`);
  }
  return `${network}/erc20:${parseEvmAddress(address)}`;
}

export function parseErc20Caip19(value: string): {
  asset: Caip19Id;
  network: Caip2Id;
  address: `0x${string}`;
} {
  const match = ERC20_CAIP19_PATTERN.exec(value);
  if (!match?.[1] || !match[2]) {
    throw new TypeError(`Invalid ERC-20 CAIP-19 asset: ${value}`);
  }
  const network = parseCaip2(match[1]);
  const address = parseEvmAddress(match[2]);
  return { asset: erc20Caip19(network, address), network, address };
}

export const BASE_MAINNET = parseCaip2("eip155:8453");
export const BASE_SEPOLIA = parseCaip2("eip155:84532");

export const BASE_ASSETS = Object.freeze({
  eth: "eip155:8453/slip44:60" as Caip19Id,
  usdc: erc20Caip19(BASE_MAINNET, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
  usdtBridged: erc20Caip19(BASE_MAINNET, "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2"),
  weth: erc20Caip19(BASE_MAINNET, "0x4200000000000000000000000000000000000006"),
});

export const BASE_ASSET_POLICY = Object.freeze({
  settlement: BASE_ASSETS.usdc,
  acquisitionInputs: [BASE_ASSETS.eth, BASE_ASSETS.weth, BASE_ASSETS.usdtBridged] as const,
  qualificationRequired: [BASE_ASSETS.usdtBridged] as const,
});
