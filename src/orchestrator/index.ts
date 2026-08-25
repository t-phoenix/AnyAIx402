import { v4 as uuidv4 } from 'uuid';
import { 
  IAgent, 
  AgentRole, 
  AgentTask, 
  BugReport, 
  DeploymentArtifact, 
  OrchestratorEvent 
} from '../types/agent';
import {
  MoveAptosAgent,
  EVMSolidityAgent,
  X402ProtocolAgent,
  CrossChainBridgeAgent,
  AIIntegrationAgent,
  QATestAutomationAgent,
  SecurityAuditAgent,
  DevOpsDeploymentAgent,
  BugReporterFixerAgent
} from '../agents/specializedAgents';
import { getManualConfigRequirements } from '../config';

export class Orchestrator {
  private agents: Map<AgentRole, IAgent> = new Map();
  private tasks: Map<string, AgentTask> = new Map();
  private bugReports: Map<string, BugReport> = new Map();
  private deployments: Map<string, DeploymentArtifact> = new Map();
  private events: OrchestratorEvent[] = [];

  constructor() {
    this.registerDefaultAgents();
  }

  private registerDefaultAgents(): void {
    this.registerAgent(new MoveAptosAgent());
    this.registerAgent(new EVMSolidityAgent());
    this.registerAgent(new X402ProtocolAgent());
    this.registerAgent(new CrossChainBridgeAgent());
    this.registerAgent(new AIIntegrationAgent());
    this.registerAgent(new QATestAutomationAgent());
    this.registerAgent(new SecurityAuditAgent());
    this.registerAgent(new DevOpsDeploymentAgent());
    this.registerAgent(new BugReporterFixerAgent());
  }

  public registerAgent(agent: IAgent): void {
    this.agents.set(agent.role, agent);
  }

  public getAgent(role: AgentRole): IAgent | undefined {
    return this.agents.get(role);
  }

  public getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  public getEvents(): OrchestratorEvent[] {
    return [...this.events];
  }

  private emitEvent(event: OrchestratorEvent): void {
    this.events.push(event);
  }

  /**
   * Dispatch a task to the specialized agent
   */
  public async dispatchTask(
    role: AgentRole,
    title: string,
    description: string,
    inputData?: any
  ): Promise<AgentTask> {
    const agent = this.agents.get(role);
    if (!agent) {
      throw new Error(`No registered agent found for role: ${role}`);
    }

    const task: AgentTask = {
      id: uuidv4(),
      role,
      title,
      description,
      inputData,
      status: 'in_progress',
      timestamp: new Date().toISOString(),
      assignedAgent: agent.name
    };

    this.tasks.set(task.id, task);
    this.emitEvent({
      type: 'task_started',
      agentRole: role,
      timestamp: new Date().toISOString(),
      data: { taskId: task.id, title }
    });

    try {
      const executed = await agent.executeTask(task);
      this.tasks.set(executed.id, executed);
      
      this.emitEvent({
        type: executed.status === 'completed' ? 'task_completed' : 'task_failed',
        agentRole: role,
        timestamp: new Date().toISOString(),
        data: { taskId: executed.id, result: executed.result, error: executed.error }
      });

      return executed;
    } catch (err: any) {
      task.status = 'failed';
      task.error = err.message;
      this.tasks.set(task.id, task);

      // Trigger automatic bug reporting & fixing
      await this.reportAndFixBug({
        title: `Task Execution Failure in ${agent.name}: ${title}`,
        severity: 'high',
        component: role,
        description: `Task failed with error: ${err.message}`,
        stackTrace: err.stack
      });

      return task;
    }
  }

  /**
   * Automated Bug Reporting & Fixing Pipeline
   */
  public async reportAndFixBug(params: {
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    component: string;
    description: string;
    stackTrace?: string;
  }): Promise<BugReport> {
    const bugId = uuidv4();
    const bugReport: BugReport = {
      id: bugId,
      title: params.title,
      severity: params.severity,
      component: params.component,
      description: params.description,
      stackTrace: params.stackTrace,
      status: 'reported',
      createdAt: new Date().toISOString()
    };

    this.bugReports.set(bugId, bugReport);
    this.emitEvent({
      type: 'bug_detected',
      agentRole: 'bug_reporter_fixer_agent',
      timestamp: new Date().toISOString(),
      data: bugReport
    });

    // Dispatch fix to BugReporterFixerAgent
    bugReport.status = 'fix_in_progress';
    const fixTask = await this.dispatchTask(
      'bug_reporter_fixer_agent',
      `Auto-Remediate: ${params.title}`,
      `Analyze and apply automated fix for ${params.component}`,
      { errorDescription: params.description, stackTrace: params.stackTrace }
    );

    if (fixTask.status === 'completed') {
      bugReport.suggestedFix = fixTask.result?.remediationPlan;
      bugReport.status = 'fixed';
      bugReport.fixedAt = new Date().toISOString();

      // Trigger QA agent to verify
      const testTask = await this.dispatchTask(
        'qa_test_automation_agent',
        `Verify Bug Fix: ${params.title}`,
        `Run verification test suite for ${params.component}`,
        { bugId }
      );

      if (testTask.result?.allPassed) {
        bugReport.status = 'verified';
      }

      this.emitEvent({
        type: 'bug_fixed',
        agentRole: 'bug_reporter_fixer_agent',
        timestamp: new Date().toISOString(),
        data: bugReport
      });
    }

    return bugReport;
  }

  public getBugReports(): BugReport[] {
    return Array.from(this.bugReports.values());
  }

  /**
   * Automated Testing Pipeline
   */
  public async runAutomatedTests(suiteName?: string): Promise<any> {
    const task = await this.dispatchTask(
      'qa_test_automation_agent',
      suiteName ? `Run Test Suite: ${suiteName}` : 'Run Comprehensive Test Suite',
      'Execute all unit, integration, crypto, and router tests',
      { suiteName }
    );

    this.emitEvent({
      type: 'test_run',
      agentRole: 'qa_test_automation_agent',
      timestamp: new Date().toISOString(),
      data: task.result
    });

    return task.result;
  }

  /**
   * Automated Deployment Pipeline
   */
  public async executeAutomatedDeployment(target: 'evm' | 'aptos_move' | 'api_service' | 'sdk'): Promise<DeploymentArtifact> {
    const deploymentId = uuidv4();
    const artifact: DeploymentArtifact = {
      network: target === 'aptos_move' ? 'Aptos Mainnet' : (target === 'evm' ? 'Base Mainnet' : 'Global Edge / NPM'),
      target,
      addressOrEndpoint: 'pending...',
      version: '1.0.0',
      status: 'deploying'
    };
    this.deployments.set(deploymentId, artifact);

    // 1. Run security audit first
    const auditTask = await this.dispatchTask(
      'security_audit_agent',
      `Pre-Deployment Audit for ${target}`,
      'Scan contracts and API configurations for security vulnerabilities',
      { target }
    );

    if (auditTask.result?.auditStatus !== 'passed') {
      artifact.status = 'failed';
      artifact.details = { error: 'Security audit failed prior to deployment' };
      return artifact;
    }

    // 2. Run automated deployment
    const deployTask = await this.dispatchTask(
      'devops_deployment_agent',
      `Deploy ${target}`,
      `Automate deployment of ${target} to target environment`,
      { target }
    );

    if (deployTask.status === 'completed') {
      artifact.status = 'deployed';
      artifact.addressOrEndpoint = deployTask.result?.endpoint || 'deployed';
      artifact.deployedAt = new Date().toISOString();
      artifact.details = deployTask.result;
    } else {
      artifact.status = 'failed';
      artifact.details = { error: deployTask.error };
    }

    this.emitEvent({
      type: 'deployment_executed',
      agentRole: 'devops_deployment_agent',
      timestamp: new Date().toISOString(),
      data: artifact
    });

    return artifact;
  }

  public getDeployments(): DeploymentArtifact[] {
    return Array.from(this.deployments.values());
  }

  /**
   * System Status & Configuration Check
   */
  public getSystemStatus(): any {
    const manualConfig = getManualConfigRequirements();
    const agentsList = this.getAllAgents().map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      capabilitiesCount: a.capabilities.length
    }));

    return {
      status: 'healthy',
      version: '1.0.0',
      activeAgents: agentsList,
      totalTasksExecuted: this.tasks.size,
      totalBugReports: this.bugReports.size,
      totalDeployments: this.deployments.size,
      manualConfigRequirements: manualConfig
    };
  }
}
