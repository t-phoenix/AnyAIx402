import { createApp } from './app.js';
import { capabilities, loadApiConfig } from './config.js';

const config = loadApiConfig();
const app = createApp({ config });

const degraded = Object.entries(capabilities(config)).filter(([, value]) => !value.enabled);

console.log(`AnyX API v${config.version} listening on http://localhost:${config.port}`);
if (degraded.length > 0) {
  console.log(`${degraded.length} capability(ies) disabled:`);
  for (const [name, report] of degraded) {
    console.log(`  - ${name}: ${report.reason}`);
  }
  console.log('Run `bun run config:missing` for the keys that enable them.');
}

export default {
  port: config.port,
  fetch: app.fetch,
};
