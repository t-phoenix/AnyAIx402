import { getHealth, getReceipts } from '../../lib/api';
import { ApiOffline } from '../offline';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<string, string> = {
  settled: 'pill pill-ok',
  pending: 'pill pill-warn',
  failed: 'pill pill-error',
};

export default async function PaymentsPage() {
  const [health, receipts] = await Promise.all([getHealth(), getReceipts()]);

  return (
    <>
      <h1 className="page-title">Payments</h1>
      <p className="page-lede">
        Every settled payment, itemized. The provider&apos;s cost and the AnyX spread are listed
        separately, because the fee is charged on top of the price rather than taken out of it.
      </p>

      {!health ? (
        <ApiOffline what="The payment history" />
      ) : receipts.length === 0 ? (
        <div className="empty">
          <div className="empty-title">No payments yet</div>
          <p style={{ marginBottom: 0 }}>
            Route one with the SDK, or call <code>POST /v1/quote</code> followed by{' '}
            <code>POST /v1/pay</code>.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Paid with</th>
                <th>Provider cost</th>
                <th>AnyX fee</th>
                <th>Status</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.receiptId}>
                  <td className="strong">{new URL(receipt.endpoint).hostname}</td>
                  <td>
                    {receipt.inputAmount} {receipt.inputToken}
                  </td>
                  <td>{receipt.apiCostUSDC} USDC</td>
                  <td>{receipt.adapterFeeUSDC} USDC</td>
                  <td>
                    <span className={STATUS_CLASS[receipt.status] ?? 'pill pill-muted'}>
                      {receipt.status}
                    </span>
                  </td>
                  <td className="mono">
                    {receipt.txHash ? `${receipt.txHash.slice(0, 10)}…` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
