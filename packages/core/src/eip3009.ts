import { type Hex, hashTypedData, recoverTypedDataAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { EIP3009Auth } from "./types.ts";

export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function eip3009Domain(chainId: number, usdcAddress: `0x${string}`) {
  return {
    name: "USD Coin",
    version: "2",
    chainId,
    verifyingContract: usdcAddress,
  } as const;
}

export function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function buildAuthorizationPayload(params: {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  chainId: number;
  usdcAddress: `0x${string}`;
  nowSeconds?: number;
}): EIP3009Auth {
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  return {
    from: params.from,
    to: params.to,
    value: params.value,
    validAfter: 0n,
    validBefore: BigInt(now + 300),
    nonce: randomNonce(),
    chainId: params.chainId,
    usdcAddress: params.usdcAddress,
  };
}

export async function signAuthorization(
  payload: EIP3009Auth,
  privateKey: Hex,
): Promise<EIP3009Auth> {
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signTypedData({
    domain: eip3009Domain(payload.chainId, payload.usdcAddress),
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: payload.from,
      to: payload.to,
      value: payload.value,
      validAfter: payload.validAfter,
      validBefore: payload.validBefore,
      nonce: payload.nonce,
    },
  });
  const { v, r, s } = splitSignature(signature);
  return { ...payload, v, r, s, signature };
}

export function splitSignature(signature: Hex): { v: number; r: `0x${string}`; s: `0x${string}` } {
  const raw = signature.slice(2);
  const r = `0x${raw.slice(0, 64)}` as `0x${string}`;
  const s = `0x${raw.slice(64, 128)}` as `0x${string}`;
  const v = Number.parseInt(raw.slice(128, 130), 16);
  return { v, r, s };
}

export async function verifyAuthorization(signed: EIP3009Auth): Promise<boolean> {
  if (!signed.signature) return false;
  const recovered = await recoverTypedDataAddress({
    domain: eip3009Domain(signed.chainId, signed.usdcAddress),
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: signed.from,
      to: signed.to,
      value: signed.value,
      validAfter: signed.validAfter,
      validBefore: signed.validBefore,
      nonce: signed.nonce,
    },
    signature: signed.signature,
  });
  return recovered.toLowerCase() === signed.from.toLowerCase();
}

export function authorizationDigest(payload: EIP3009Auth): Hex {
  return hashTypedData({
    domain: eip3009Domain(payload.chainId, payload.usdcAddress),
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: payload.from,
      to: payload.to,
      value: payload.value,
      validAfter: payload.validAfter,
      validBefore: payload.validBefore,
      nonce: payload.nonce,
    },
  });
}
