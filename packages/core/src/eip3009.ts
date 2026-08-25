import { type Hex, bytesToHex, hexToSignature, recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { AnyxError } from './errors';
import type { SignedAuthorization, TransferAuthorizationPayload } from './types';

const AUTHORIZATION_WINDOW_SECONDS = 300; // 5 minutes

export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export interface BuildAuthorizationParams {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  chainId: number;
  usdcAddress: `0x${string}`;
}

/**
 * Task 1.4.1 — Builds an unsigned EIP-3009 transferWithAuthorization payload.
 * validAfter=0 (immediate), validBefore = now + 5 minutes, nonce = random 32 bytes.
 */
export function buildAuthorizationPayload(
  params: BuildAuthorizationParams,
): TransferAuthorizationPayload {
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);

  return {
    from: params.from,
    to: params.to,
    value: params.value,
    validAfter: 0n,
    validBefore: BigInt(Math.floor(Date.now() / 1000) + AUTHORIZATION_WINDOW_SECONDS),
    nonce: bytesToHex(nonceBytes),
    chainId: params.chainId,
    usdcAddress: params.usdcAddress,
  };
}

function buildDomain(chainId: number, usdcAddress: `0x${string}`) {
  return {
    name: 'USD Coin',
    version: '2',
    chainId,
    verifyingContract: usdcAddress,
  } as const;
}

function buildMessage(payload: TransferAuthorizationPayload) {
  return {
    from: payload.from,
    to: payload.to,
    value: payload.value,
    validAfter: payload.validAfter,
    validBefore: payload.validBefore,
    nonce: payload.nonce,
  } as const;
}

/**
 * Task 1.4.2 — Signs the EIP-712 TransferWithAuthorization payload using viem.
 * `privateKey` is the AnyX hot signer key (Phase 1 convenience; MPC-managed in production —
 * see docs/CONFIGURATION.md security notes).
 */
export async function signAuthorization(
  payload: TransferAuthorizationPayload,
  privateKey: `0x${string}`,
): Promise<SignedAuthorization> {
  const account = privateKeyToAccount(privateKey);

  if (account.address.toLowerCase() !== payload.from.toLowerCase()) {
    throw new AnyxError('INVALID_INPUT', 'privateKey does not correspond to payload.from address');
  }

  const domain = buildDomain(payload.chainId, payload.usdcAddress);
  const message = buildMessage(payload);

  const signature = await account.signTypedData({
    domain,
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: 'TransferWithAuthorization',
    message,
  });

  const { v, r, s } = hexToSignature(signature);

  return {
    ...payload,
    v: Number(v),
    r,
    s,
    signature,
  };
}

/**
 * Task 1.4.3 — Recovers the signer address from the EIP-712 digest (pure, no network calls —
 * suitable for EOAs, which is all Phase 1's hot signer uses) and confirms it matches `from`.
 */
export async function verifyAuthorization(signed: SignedAuthorization): Promise<boolean> {
  const domain = buildDomain(signed.chainId, signed.usdcAddress);
  const message = buildMessage(signed);

  try {
    const recovered = await recoverTypedDataAddress({
      domain,
      types: TRANSFER_WITH_AUTHORIZATION_TYPES,
      primaryType: 'TransferWithAuthorization',
      message,
      signature: signed.signature,
    });
    return recovered.toLowerCase() === signed.from.toLowerCase();
  } catch {
    return false;
  }
}

export type { Hex };
