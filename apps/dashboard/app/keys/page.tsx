export const dynamic = 'force-dynamic';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    limits: ['100 requests/minute', '$100/month routed volume', 'Standard swap spread'],
  },
  {
    name: 'Pro',
    price: '$49/mo',
    limits: ['1000 requests/minute', 'Unlimited volume', 'Priority facilitator failover'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    limits: ['Custom limits', 'Dedicated float pool', 'Partner fee sharing'],
  },
] as const;

export default function KeysPage() {
  return (
    <>
      <h1 className="page-title">API keys</h1>
      <p className="page-lede">
        Keys are optional. The free tier works unauthenticated; a key raises your rate limit and
        attributes routed volume to your account.
      </p>

      <div className="empty">
        <div className="empty-title">Key management is not implemented yet</div>
        <p>
          It is <code>6.1-api-keys-billing</code> in the build graph, and it depends on the API
          server and a database.
        </p>
        <p style={{ marginBottom: 0 }}>
          Run <code>./scripts/orchestrate plan</code> to see where it sits.
        </p>
      </div>

      <div className="section-title">Planned tiers</div>
      <div className="grid">
        {PLANS.map((plan) => (
          <div key={plan.name} className="card">
            <div className="stat-label">{plan.name}</div>
            <div className="stat-value" style={{ fontSize: 21 }}>
              {plan.price}
            </div>
            <ul style={{ margin: '12px 0 0', paddingLeft: 17, color: 'var(--text-dim)' }}>
              {plan.limits.map((limit) => (
                <li key={limit} style={{ fontSize: 12.5, marginBottom: 3 }}>
                  {limit}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="section-title">Using a key</div>
      <div className="card">
        <p style={{ marginTop: 0, color: 'var(--text-dim)' }}>
          Send it as an <span className="inline-code">X-API-Key</span> header, or hand it to the
          SDK:
        </p>
        <pre
          className="mono"
          style={{
            margin: 0,
            padding: 14,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflowX: 'auto',
            color: 'var(--text-dim)',
          }}
        >
          {`const upa = new UPA({
  apiKey: 'anyx_…',
  preferredToken: 'ETH',
  preferredChainId: 8453,
});`}
        </pre>
      </div>
    </>
  );
}
