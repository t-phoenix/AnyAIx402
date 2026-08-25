import { formatMissingReport, getConfigStatus, loadConfig } from "@anyx/config";

const strict = process.argv.includes("--strict");
const allowMissing = process.argv.includes("--allow-missing") || !strict;

const config = loadConfig();
const status = getConfigStatus(config);
const report = formatMissingReport(status);
console.log(report);

if (strict && !status.capabilities.quote_live) {
  console.error("\n--strict: live quotes are not configured.");
  process.exit(1);
}

if (!allowMissing && status.missing.length > 0 && !status.capabilities.pay_live) {
  process.exit(1);
}

process.exit(0);
