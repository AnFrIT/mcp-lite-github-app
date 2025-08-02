const express = require('express');
const { createNodeMiddleware } = require('@octokit/webhooks');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Create Express app
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      hasAppId: !!process.env.GITHUB_APP_ID,
      hasPrivateKey: !!process.env.GITHUB_APP_PRIVATE_KEY,
      hasWebhookSecret: !!process.env.GITHUB_WEBHOOK_SECRET,
      hasClaudeToken: !!process.env.CLAUDE_CODE_OAUTH_TOKEN
    }
  });
});

// Initialize app asynchronously
let githubApp = null;
let webhooks = null;
let orchestratorClass = null;

async function initializeApp() {
  if (githubApp) return;
  
  try {
    // Dynamic imports for ESM modules
    const { App } = await import('@octokit/app');
    const { Webhooks } = await import('@octokit/webhooks');
    
    // Verify environment variables
    const APP_ID = process.env.GITHUB_APP_ID;
    const PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY;
    const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
    const CLAUDE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    
    if (!APP_ID || !PRIVATE_KEY || !WEBHOOK_SECRET || !CLAUDE_OAUTH_TOKEN) {
      throw new Error('Missing required environment variables');
    }
    
    // Initialize GitHub App
    githubApp = new App({
      appId: parseInt(APP_ID),
      privateKey: PRIVATE_KEY,
    });
    
    // Initialize webhooks
    webhooks = new Webhooks({
      secret: WEBHOOK_SECRET
    });
    
    // Import MCPLiteOrchestrator class
    const orchestratorModule = require('./orchestrator');
    orchestratorClass = orchestratorModule.MCPLiteOrchestrator;
    
    // Setup webhook handlers
    webhooks.on('issues.opened', async ({ octokit, payload }) => {
      if (!payload.issue.labels?.some(label => label.name === 'claude-build')) {
        return;
      }
      
      const orchestrator = new orchestratorClass(
        octokit,
        payload.repository.owner.login,
        payload.repository.name,
        payload.issue.number
      );
      
      await orchestrator.processRequest(payload.issue.body || '');
    });
    
    webhooks.on('issue_comment.created', async ({ octokit, payload }) => {
      if (payload.comment.body.includes('APPROVED')) {
        await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          issue_number: payload.issue.number,
          body: '✅ Project completed successfully!'
        });
      }
    });
    
    console.log('GitHub App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize GitHub App:', error);
    throw error;
  }
}

// Main webhook handler
app.post('/api/github/webhooks', async (req, res) => {
  try {
    await initializeApp();
    
    const signature = req.get('x-hub-signature-256');
    if (!signature) {
      return res.status(401).send('Missing signature');
    }
    
    // Verify and handle webhook
    await webhooks.verifyAndReceive({
      id: req.get('x-github-delivery'),
      name: req.get('x-github-event'),
      payload: req.body,
      signature: signature
    });
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(error.status || 500).send(error.message);
  }
});

// Default route
app.get('/', (req, res) => {
  res.json({
    name: 'MCP-LITE V2.5 GitHub App',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      health: '/health',
      webhooks: '/api/github/webhooks'
    }
  });
});

// Export for Vercel
module.exports = app;