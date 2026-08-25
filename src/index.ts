import express, { Request, Response } from 'express';
import cors from 'cors';
import { Orchestrator } from './orchestrator';
import { QuoteEngine } from './core/quote';
import { TOKEN_REGISTRY } from './core/tokens';
import { getConfig, getManualConfigRequirements } from './config';
import { AgentRole } from './types/agent';

export function createServer(orchestrator?: Orchestrator) {
  const app = express();
  const orch = orchestrator || new Orchestrator();
  const quoteEngine = new QuoteEngine();
  const config = getConfig();

  app.use(cors());
  app.use(express.json());

  // Health Check
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'AnyAIx402-Universal-Adapter',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // System Status & Orchestration Insights
  app.get('/v1/orchestrator/status', (req: Request, res: Response) => {
    res.json(orch.getSystemStatus());
  });

  // Manual Configuration Requirements Endpoint (Easy for User to Inspect & Config)
  app.get('/v1/config/requirements', (req: Request, res: Response) => {
    res.json({
      description: 'API and Payment Configuration status. Use .env to configure missing keys.',
      sections: getManualConfigRequirements()
    });
  });

  // List all registered AI Agents
  app.get('/v1/orchestrator/agents', (req: Request, res: Response) => {
    res.json({
      agents: orch.getAllAgents().map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        description: a.description,
        capabilities: a.capabilities
      }))
    });
  });

  // Trigger task on a specialized agent
  app.post('/v1/orchestrator/dispatch', async (req: Request, res: Response) => {
    try {
      const { role, title, description, inputData } = req.body;
      if (!role || !title) {
        return res.status(400).json({ error: 'Missing role or title' });
      }
      const task = await orch.dispatchTask(role as AgentRole, title, description || '', inputData);
      res.json({ task });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Automated Bug Reporting & Remediation
  app.post('/v1/orchestrator/report-bug', async (req: Request, res: Response) => {
    try {
      const { title, severity, component, description, stackTrace } = req.body;
      const report = await orch.reportAndFixBug({
        title: title || 'Reported runtime issue',
        severity: severity || 'medium',
        component: component || 'api',
        description: description || 'No details provided',
        stackTrace
      });
      res.json({ bugReport: report });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all Bug Reports
  app.get('/v1/orchestrator/bugs', (req: Request, res: Response) => {
    res.json({ bugs: orch.getBugReports() });
  });

  // Automated Testing Trigger
  app.post('/v1/orchestrator/run-tests', async (req: Request, res: Response) => {
    try {
      const { suiteName } = req.body;
      const result = await orch.runAutomatedTests(suiteName);
      res.json({ testResults: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Automated Deployment Trigger
  app.post('/v1/orchestrator/deploy', async (req: Request, res: Response) => {
    try {
      const { target } = req.body;
      if (!target) {
        return res.status(400).json({ error: 'Missing deployment target (evm, aptos_move, api_service, sdk)' });
      }
      const artifact = await orch.executeAutomatedDeployment(target);
      res.json({ deployment: artifact });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // List all deployment artifacts
  app.get('/v1/orchestrator/deployments', (req: Request, res: Response) => {
    res.json({ deployments: orch.getDeployments() });
  });

  // Supported Tokens
  app.get('/v1/tokens', (req: Request, res: Response) => {
    res.json({
      tokens: TOKEN_REGISTRY,
      updatedAt: new Date().toISOString()
    });
  });

  // x402 Quote Endpoint
  app.post('/v1/quote', async (req: Request, res: Response) => {
    try {
      const { endpointUrl, inputToken, inputChainId, slippageBps } = req.body;
      if (!endpointUrl || !inputToken || inputChainId === undefined) {
        return res.status(400).json({ error: 'Missing required parameters: endpointUrl, inputToken, inputChainId' });
      }
      const quote = await quoteEngine.getQuote({
        endpointUrl,
        inputToken,
        inputChainId: Number(inputChainId),
        slippageBps
      });
      res.json(quote);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // x402 Pay Endpoint
  app.post('/v1/pay', async (req: Request, res: Response) => {
    try {
      const { quoteId, walletAddress } = req.body;
      if (!quoteId) {
        return res.status(400).json({ error: 'Missing quoteId' });
      }
      const quote = quoteEngine.getCachedQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ error: 'Quote expired or not found' });
      }

      // Simulate payment settlement and receipt issuance
      const receipt = {
        receiptId: `rcpt_${Date.now()}`,
        status: 'settled',
        txHash: '0x3a4f89d9e6e8c7b5a1f2e3d4c5b6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4',
        blockNumber: 22891234,
        inputToken: quote.inputToken,
        inputAmount: quote.inputAmount,
        usdcSettled: quote.usdcRequired,
        feeUsdc: quote.feeUsdc,
        apiResponse: { success: true, data: 'Sample premium content from x402 resource' },
        xPaymentResponse: Buffer.from(JSON.stringify({ settled: true, tx: '0x3a4f...' })).toString('base64')
      };

      res.json(receipt);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

export function startServer(port?: number) {
  const config = getConfig();
  const PORT = port || config.PORT || 3000;
  const app = createServer();
  return app.listen(PORT, () => {
    console.log(`🚀 AnyAIx402 Server & Multi-Agent Orchestrator running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}
