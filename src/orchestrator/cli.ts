import { Orchestrator } from './index';

async function main() {
  console.log('================================================================');
  console.log('🤖 Starting AnyAIx402 Multi-Agent Orchestrator CLI Run');
  console.log('================================================================\n');

  const orch = new Orchestrator();

  console.log('1. Active Specialized Agents:');
  orch.getAllAgents().forEach(agent => {
    console.log(`   - [${agent.role}] ${agent.name} (${agent.capabilities.length} capabilities)`);
  });

  console.log('\n2. Testing Multi-Agent Task Dispatch:');
  const quoteTask = await orch.dispatchTask(
    'x402_protocol_engineer',
    'Get ETH Swap Quote',
    'Calculate ETH required to settle $1.50 USDC x402 endpoint',
    { endpointUrl: 'https://api.example.com/premium', token: 'ETH', chainId: 8453, amount: '1.50' }
  );
  console.log('   Result from x402 Engineer:', quoteTask.result);

  console.log('\n3. Testing Move Aptos Specialist Agent:');
  const moveTask = await orch.dispatchTask(
    'move_aptos_specialist',
    'Audit Aptos Router Move Module',
    'Analyze AnyXRouter.move for coin transfer security and fee mechanics',
    { module: 'anyx_x402::router' }
  );
  console.log('   Result from Move Specialist:', moveTask.result);

  console.log('\n4. Testing Automated QA Test Suite Run:');
  const testResults = await orch.runAutomatedTests();
  console.log('   QA Test Results:', testResults);

  console.log('\n5. Testing Automated Bug Detection & Auto-Fixing:');
  const bugReport = await orch.reportAndFixBug({
    title: 'Simulated Quote API Timeout',
    severity: 'medium',
    component: 'quote_engine',
    description: '1inch upstream responded with 504 Gateway Timeout on Base chain',
    stackTrace: 'Error: Upstream 504\n at fetchDEXQuote (quote.ts:45)'
  });
  console.log('   Bug Report Status:', bugReport.status, '| Suggested Fix:', bugReport.suggestedFix);

  console.log('\n6. Testing Automated Deployment:');
  const deployment = await orch.executeAutomatedDeployment('aptos_move');
  console.log('   Aptos Move Deployment:', deployment);

  console.log('\n7. System Status & Manual Config Status:');
  const status = orch.getSystemStatus();
  console.log('   Total Tasks Executed:', status.totalTasksExecuted);
  console.log('   Total Bug Reports:', status.totalBugReports);
  console.log('   Total Deployments:', status.totalDeployments);

  console.log('\n================================================================');
  console.log('✅ Orchestrator execution complete!');
  console.log('================================================================');
}

if (require.main === module) {
  main().catch(console.error);
}
