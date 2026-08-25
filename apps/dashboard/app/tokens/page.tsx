import { chainName, getHealth, getTokens } from '../../lib/api';
import { ApiOffline } from '../offline';

export const dynamic = 'force-dynamic';

export default async function TokensPage() {
  const [health, tokens] = await Promise.all([getHealth(), getTokens()]);

  const byChain = new Map<number, typeof tokens>();
  for (const token of tokens) {
    byChain.set(token.chainId, [...(byChain.get(token.chainId) ?? []), token]);
  }

  return (
    <>
      <h1 className="page-title">Tokens</h1>
      <p className="page-lede">
        Every token a payer can settle with. Whichever they choose, the provider receives USDC on
        Base.
      </p>

      {!health ? (
        <ApiOffline what="The token registry" />
      ) : (
        [...byChain.entries()]
          .sort(([a], [b]) => a - b)
          .map(([chainId, chainTokens]) => (
            <div key={chainId}>
              <div className="section-title">
                {chainName(chainId)} · {chainTokens.length} token(s)
              </div>
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Name</th>
                      <th>Address</th>
                      <th>Decimals</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chainTokens.map((token) => (
                      <tr key={`${token.chainId}-${token.symbol}`}>
                        <td className="strong">{token.symbol}</td>
                        <td>{token.name}</td>
                        <td className="mono">
                          {token.address
                            ? `${token.address.slice(0, 10)}…${token.address.slice(-6)}`
                            : 'native'}
                        </td>
                        <td>{token.decimals}</td>
                        <td>
                          {token.priceUsd ? (
                            `$${token.priceUsd}`
                          ) : (
                            <span className="pill pill-muted">no price feed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
      )}
    </>
  );
}
