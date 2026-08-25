export type AgentRole = 
  | 'orchestrator'
  | 'move_aptos_specialist'
  | 'evm_solidity_specialist'
  | 'x402_protocol_engineer'
  | 'crosschain_bridge_expert'
  | 'ai_integration_agent'
  | 'qa_test_automation_agent'
  | 'security_audit_agent'
  | 'devops_deployment_agent'
  | 'bug_reporter_fixer_agent';

export interface AgentTask {
  id: string;
  role: AgentRole;
  title: string;
  description: string;
  inputData?: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
  timestamp: string;
  assignedAgent?: string;
}

export interface BugReport {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  stackTrace?: string;
  reproductionSteps?: string[];
  suggestedFix?: string;
  status: 'reported' | 'triaged' | 'fix_in_progress' | 'fixed' | 'verified';
  createdAt: string;
  fixedAt?: string;
}

export interface DeploymentArtifact {
  network: string;
  target: 'evm' | 'aptos_move' | 'api_service' | 'sdk';
  addressOrEndpoint: string;
  version: string;
  status: 'pending' | 'deploying' | 'deployed' | 'verified' | 'failed';
  deployedAt?: string;
  details?: Record<string, any>;
}

export interface IAgent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  capabilities: string[];
  executeTask(task: AgentTask): Promise<AgentTask>;
}

export interface OrchestratorEvent {
  type: 'task_started' | 'task_completed' | 'task_failed' | 'bug_detected' | 'bug_fixed' | 'test_run' | 'deployment_executed';
  agentRole: AgentRole;
  timestamp: string;
  data: any;
}
