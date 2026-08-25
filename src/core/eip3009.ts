import { ethers, Wallet, HDNodeWallet, Signer } from 'ethers';

export interface EIP3009AuthParams {
  from: string;
  to: string;
  value: bigint | string;
  validAfter?: number;
  validBefore?: number;
  nonce?: string;
  chainId: number;
  usdcAddress: string;
}

export interface SignedEIP3009Auth {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  v: number;
  r: string;
  s: string;
  signature: string;
}

export class EIP3009Signer {
  /**
   * Generates a random 32-byte nonce
   */
  public static generateNonce(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }

  /**
   * Sign EIP-3009 TransferWithAuthorization using EIP-712 Typed Data
   */
  public static async signAuthorization(
    params: EIP3009AuthParams,
    walletOrPrivateKey: Wallet | HDNodeWallet | Signer | string
  ): Promise<SignedEIP3009Auth> {
    const signer = typeof walletOrPrivateKey === 'string'
      ? new ethers.Wallet(walletOrPrivateKey)
      : (walletOrPrivateKey as any);

    const nonce = params.nonce || this.generateNonce();
    const validAfter = params.validAfter ?? 0;
    const validBefore = params.validBefore ?? (Math.floor(Date.now() / 1000) + 300); // 5 min validity

    const domain = {
      name: 'USD Coin',
      version: '2',
      chainId: params.chainId,
      verifyingContract: params.usdcAddress
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    };

    const valueStr = params.value.toString();

    const message = {
      from: params.from,
      to: params.to,
      value: valueStr,
      validAfter,
      validBefore,
      nonce
    };

    const signature = await signer.signTypedData(domain, types, message);
    const splitSig = ethers.Signature.from(signature);

    return {
      from: params.from,
      to: params.to,
      value: valueStr,
      validAfter,
      validBefore,
      nonce,
      v: splitSig.v,
      r: splitSig.r,
      s: splitSig.s,
      signature
    };
  }

  /**
   * Verify signature matches the from address
   */
  public static verifyAuthorization(
    auth: SignedEIP3009Auth,
    chainId: number,
    usdcAddress: string
  ): boolean {
    const domain = {
      name: 'USD Coin',
      version: '2',
      chainId,
      verifyingContract: usdcAddress
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    };

    const message = {
      from: auth.from,
      to: auth.to,
      value: auth.value,
      validAfter: auth.validAfter,
      validBefore: auth.validBefore,
      nonce: auth.nonce
    };

    const recovered = ethers.verifyTypedData(domain, types, message, auth.signature);
    return recovered.toLowerCase() === auth.from.toLowerCase();
  }
}
