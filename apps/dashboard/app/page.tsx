import { getHealth, getReceipts, getTokens } from '../lib/api';
import { ApiOffline } from './offline';

export const dynamic = 'force-dynamic';

function formatUsd(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `$${parsed.toFixed(4)}` : value;
}

export default async function OverviewPage() {
  const [health, tokens, receipts] = await Promise.all([getHealth(), getTokens(), getReceipts()]);

  const settled = receipts.filter((receipt) => receipt.status === 'settled');
  const volume = settled.reduce((total, receipt) => total + Number(receipt.apiCostUSDC || 0), 0);
  const revenue = settled.reduce(
    (total, receipt) => total + Number(receipt.adapterFeeUSDC || 0),
    0,
  );

  const disabled = health
    ? Object.entries(health.capabilities).filter(([, report]) => !report.enabled)
    : [];

  return (
    <>
      <h1 className="page-title">Overview</h1>
      <p className="page-lede">
        AnyX intercepts x402 payment challenges and lets any token holder settle them. The API
        provider always receives USDC on Base and never learns which token was used.
      </p>

      {!health ? (
        <ApiOffline what="This page" />
      ) : (
        <>
          {disabled.length > 0 ? (
            <div className="notice">
              <span aria-hidden="true">!</span>
              <div className="notice-body">
                <div className="notice-title">
                  {disabled.length} capabilit{disabled.length === 1 ? 'y is' : 'ies are'} disabled
                </div>
                The API is serving in a degraded mode. Run{' '}
                <span className="inline-code">bun run config:missing</span> to see which credentials
                would turn them on.
              </div>
            </div>
          ) : null}

          <div className="grid">
            <div className="card">
              <div className="stat-label">Volume routed</div>
              <div className="stat-value">{formatUsd(String(volume))}</div>
              <div className="stat-note">USDC delivered to providers</div>
            </div>
            <div className="card">
              <div className="stat-label">Spread earned</div>
              <div className="stat-value">{formatUsd(String(revenue))}</div>
              <div className="stat-note">across {settled.length} settled payment(s)</div>
            </div>
            <div className="card">
              <div className="stat-label">Supported tokens</div>
              <div className="stat-value">{tokens.length}</div>
              <div className="stat-note">
                {new Set(tokens.map((token) => token.chainId)).size} chain(s)
              </div>
            </div>
            <div className="card">
              <div className="stat-label">API</div>
              <div className="stat-value" style={{ fontSize: 19 }}>
                v{health.version}
              </div>
              <div className="stat-note">
                persistence: {health.persistence} · limits: {health.rateLimiter}
              </div>
            </div>
          </div>

          <div className="section-title">Capabilities</div>
          <div className="card">
            {Object.entries(health.capabilities).map(([name, report]) => (
              <div key={name} className="capability-row">
                <div>
                  <div className="capability-name">{name}</div>
                  {report.reason ? <div className="capability-reason">{report.reason}</div> : null}
                </div>
                <span className={report.enabled ? 'pill pill-ok' : 'pill pill-muted'}>
                  {report.enabled ? 'enabled' : 'off'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
