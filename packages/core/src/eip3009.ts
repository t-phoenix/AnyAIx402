import { type Address, getAddress, type Hex, recoverTypedDataAddress, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { SignatureError, ValidationError } from './errors.js';
import { CHAIN_ID_BASE, USDC_BASE_ADDRESS } from './tokens.js';
import type { EIP3009Auth, SignedAuthorization, TransferAuthorizationPayload } from './types.js';

/** x402 authorizations are short-lived by design (whitepaper §6). */
export const AUTHORIZATION_VALIDITY_SECONDS = 300;

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

export const USDC_EIP712_NAME = 'USD Coin';
export const USDC_EIP712_VERSION = '2';

export interface BuildAuthorizationParams {
  from: string;
  to: string;
  /** USDC atomic units (6 decimals). */
  value: bigint | string;
  chainId?: number;
  usdcAddress?: string;
  validitySeconds?: number;
  /** Injectable clock, in milliseconds, for deterministic tests. */
  now?: () => number;
  nonce?: Hex;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

export function randomNonce(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function toBigInt(value: bigint | string, field: string): bigint {
  if (typeof value === 'bigint') return value;
  if (!/^\d+$/.test(value.trim())) {
    throw new ValidationError(`${field} must be a non-negative integer string, got "${value}"`);
  }
  return BigInt(value);
}

/**
 * Builds an unsigned EIP-3009 `TransferWithAuthorization` payload: a fresh random
 * 32-byte nonce, immediately valid, expiring 5 minutes out.
 */
export function buildAuthorizationPayload(
  params: BuildAuthorizationParams,
): TransferAuthorizationPayload {
  const value = toBigInt(params.value, 'value');
  if (value <= 0n) throw new ValidationError('Authorization value must be greater than zero');

  const nowMs = params.now?.() ?? Date.now();
  const validitySeconds = params.validitySeconds ?? AUTHORIZATION_VALIDITY_SECONDS;
  if (validitySeconds <= 0) {
    throw new ValidationError('validitySeconds must be greater than zero');
  }

  return {
    from: getAddress(params.from),
    to: getAddress(params.to),
    value,
    validAfter: 0n,
    validBefore: BigInt(Math.floor(nowMs / 1_000) + validitySeconds),
    nonce: params.nonce ?? randomNonce(),
    chainId: params.chainId ?? CHAIN_ID_BASE,
    usdcAddress: getAddress(params.usdcAddress ?? USDC_BASE_ADDRESS),
  };
}

export function buildDomain(
  payload: Pick<TransferAuthorizationPayload, 'chainId' | 'usdcAddress'>,
  overrides: { name?: string; version?: string } = {},
): EIP712Domain {
  return {
    name: overrides.name ?? USDC_EIP712_NAME,
    version: overrides.version ?? USDC_EIP712_VERSION,
    chainId: payload.chainId,
    verifyingContract: payload.usdcAddress,
  };
}

function typedDataFor(
  payload: TransferAuthorizationPayload,
  domainOverrides: { name?: string; version?: string } = {},
) {
  return {
    domain: buildDomain(payload, domainOverrides),
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: 'TransferWithAuthorization' as const,
    message: {
      from: payload.from,
      to: payload.to,
      value: payload.value,
      validAfter: payload.validAfter,
      validBefore: payload.validBefore,
      nonce: payload.nonce,
    },
  };
}

export interface SignatureParts {
  v: number;
  r: Hex;
  s: Hex;
}

export function splitSignature(signature: Hex): SignatureParts {
  const hex = signature.startsWith('0x') ? signature.slice(2) : signature;
  if (hex.length !== 130) {
    throw new SignatureError(`Expected a 65-byte signature, got ${hex.length / 2} bytes`);
  }
  const v = Number.parseInt(hex.slice(128, 130), 16);
  return {
    r: `0x${hex.slice(0, 64)}` as Hex,
    s: `0x${hex.slice(64, 128)}` as Hex,
    // Some signers return 0/1 for yParity; normalise to the 27/28 form USDC expects.
    v: v < 27 ? v + 27 : v,
  };
}

export interface SignAuthorizationOptions {
  domainName?: string;
  domainVersion?: string;
}

/**
 * Signs the payload with the AnyX hot signer key.
 *
 * In production the key lives behind MPC (Turnkey / Lit); this function only ever
 * receives it as an argument and never reads it from disk.
 */
export async function signAuthorization(
  payload: TransferAuthorizationPayload,
  privateKey: string,
  options: SignAuthorizationOptions = {},
): Promise<SignedAuthorization> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new ValidationError('privateKey must be a 0x-prefixed 32-byte hex string');
  }

  const account = privateKeyToAccount(privateKey as Hex);
  if (account.address.toLowerCase() !== payload.from.toLowerCase()) {
    throw new SignatureError('Signer address does not match the authorization `from` address', {
      details: { signer: account.address, from: payload.from },
    });
  }

  const typedData = typedDataFor(payload, {
    name: options.domainName,
    version: options.domainVersion,
  });
  const signature = await account.signTypedData(typedData);

  return { ...payload, ...splitSignature(signature), signature };
}

/** Recovers the signer from the EIP-712 digest and compares it to `from`. */
export async function verifyAuthorization(
  signed: SignedAuthorization,
  options: SignAuthorizationOptions = {},
): Promise<boolean> {
  try {
    const recovered = await recoverTypedDataAddress({
      ...typedDataFor(signed, { name: options.domainName, version: options.domainVersion }),
      signature: signed.signature,
    });
    return recovered.toLowerCase() === signed.from.toLowerCase();
  } catch {
    return false;
  }
}

export function serializeAuthorization(auth: EIP3009Auth): {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
  v: number;
  r: Hex;
  s: Hex;
  signature: Hex;
} {
  return {
    from: auth.from,
    to: auth.to,
    value: auth.value.toString(),
    validAfter: auth.validAfter.toString(),
    validBefore: auth.validBefore.toString(),
    nonce: auth.nonce,
    v: auth.v,
    r: auth.r,
    s: auth.s,
    signature: auth.signature,
  };
}

export function isAuthorizationExpired(
  auth: Pick<TransferAuthorizationPayload, 'validBefore'>,
  now: number = Date.now(),
): boolean {
  return auth.validBefore <= BigInt(Math.floor(now / 1_000));
}
