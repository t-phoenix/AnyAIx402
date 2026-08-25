import { ethers } from 'ethers';
import { EIP3009Signer } from '../src/core/eip3009';

describe('EIP-3009 Cryptographic Signatures', () => {
  const wallet = ethers.Wallet.createRandom();
  const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const chainId = 8453; // Base

  it('should generate a 32-byte unique random nonce', () => {
    const nonce1 = EIP3009Signer.generateNonce();
    const nonce2 = EIP3009Signer.generateNonce();
    expect(nonce1).not.toEqual(nonce2);
    expect(nonce1.length).toBe(66); // 0x + 64 hex characters
  });

  it('should sign and verify EIP-3009 TransferWithAuthorization', async () => {
    const recipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const auth = await EIP3009Signer.signAuthorization(
      {
        from: wallet.address,
        to: recipient,
        value: '1000000', // 1 USDC in atomic units
        chainId,
        usdcAddress
      },
      wallet
    );

    expect(auth.from).toBe(wallet.address);
    expect(auth.to).toBe(recipient);
    expect(auth.signature).toBeDefined();
    expect(auth.v).toBeDefined();
    expect(auth.r).toBeDefined();
    expect(auth.s).toBeDefined();

    const isValid = EIP3009Signer.verifyAuthorization(auth, chainId, usdcAddress);
    expect(isValid).toBe(true);
  });
});
