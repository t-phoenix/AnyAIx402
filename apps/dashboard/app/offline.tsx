import { API_BASE_URL } from '../lib/api';

/**
 * Shown whenever the API cannot be reached. The dashboard is expected to be
 * opened before the backend is running, so this explains the situation and how
 * to fix it rather than rendering an error.
 */
export function ApiOffline({ what }: { what: string }) {
  return (
    <div className="empty">
      <div className="empty-title">The API is not reachable</div>
      <p>
        {what} needs the AnyX API at <code>{API_BASE_URL}</code>.
      </p>
      <p style={{ marginBottom: 0 }}>
        Start it with <code>bun run dev</code>, or point the dashboard elsewhere with{' '}
        <code>NEXT_PUBLIC_ANYX_API_URL</code>.
      </p>
    </div>
  );
}
