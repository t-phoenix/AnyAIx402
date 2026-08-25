import { Orchestrator } from '../src/orchestrator';

describe('Multi-Agent Orchestrator Tests', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  it('should initialize with all 9 domain-specialized agents', () => {
    const agents = orchestrator.getAllAgents();
    expect(agents.length).toBe(9);

    const roles = agents.map(a => a.role);
    expect(roles).toContain('move_aptos_specialist');
    expect(roles).toContain('evm_solidity_specialist');
    expect(roles).toContain('x402_protocol_engineer');
    expect(roles).toContain('crosschain_bridge_expert');
    expect(roles).toContain('ai_integration_agent');
    expect(roles).toContain('qa_test_automation_agent');
    expect(roles).toContain('security_audit_agent');
    expect(roles).toContain('devops_deployment_agent');
    expect(roles).toContain('bug_reporter_fixer_agent');
  });

  it('should dispatch tasks to Move Aptos Specialist agent', async () => {
    const task = await orchestrator.dispatchTask(
      'move_aptos_specialist',
      'Audit Move Module',
      'Verify coin transfer safety in AnyXRouter.move'
    );

    expect(task.status).toBe('completed');
    expect(task.result).toBeDefined();
    expect(task.result.analysis).toContain('Move module verified');
  });

  it('should automatically report, triage, fix, and verify bugs', async () => {
    const bug = await orchestrator.reportAndFixBug({
      title: 'Facilitator 503 Service Unavailable',
      severity: 'high',
      component: 'x402_facilitator',
      description: 'Coinbase CDP facilitator temporarily unreachable'
    });

    expect(bug).toBeDefined();
    expect(bug.status).toBe('verified');
    expect(bug.suggestedFix).toBeDefined();
  });

  it('should run automated QA testing suites', async () => {
    const testRun = await orchestrator.runAutomatedTests('Full Suite');
    expect(testRun).toBeDefined();
    expect(testRun.allPassed).toBe(true);
    expect(testRun.testSuites.length).toBeGreaterThan(0);
  });

  it('should execute automated deployments with security pre-audit', async () => {
    const deployment = await orchestrator.executeAutomatedDeployment('aptos_move');
    expect(deployment).toBeDefined();
    expect(deployment.status).toBe('deployed');
    expect(deployment.network).toContain('Aptos');
  });

  it('should expose system status with manual configuration requirements', () => {
    const status = orchestrator.getSystemStatus();
    expect(status.status).toBe('healthy');
    expect(status.activeAgents.length).toBe(9);
    expect(status.manualConfigRequirements.length).toBeGreaterThan(0);
  });
});
