const express = require('express');
const crypto = require('crypto');

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

// Main webhook handler
app.post('/api/github/webhooks', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.get('x-hub-signature-256');
    if (!signature) {
      return res.status(401).send('Missing signature');
    }
    
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const payload = JSON.stringify(req.body);
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).send('Invalid signature');
    }
    
    // Get event type
    const event = req.get('x-github-event');
    console.log(`Received ${event} webhook`);
    
    // Handle different events
    if (event === 'issues' && req.body.action === 'opened') {
      await handleIssueOpened(req.body);
    } else if (event === 'issue_comment' && req.body.action === 'created') {
      await handleIssueComment(req.body);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send(error.message);
  }
});

// Handle issue opened event
async function handleIssueOpened(payload) {
  // Check for claude-build label
  if (!payload.issue.labels?.some(label => label.name === 'claude-build')) {
    console.log('Issue does not have claude-build label, skipping');
    return;
  }
  
  console.log(`Processing issue #${payload.issue.number}: ${payload.issue.title}`);
  
  // Import and initialize orchestrator
  const { MCPLiteOrchestrator } = require('./orchestrator');
  
  // Create GitHub API client using dynamic import
  const { Octokit } = await import('octokit');
  const { createAppAuth } = await import('@octokit/auth-app');
  
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: parseInt(process.env.GITHUB_APP_ID),
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
      installationId: payload.installation.id
    }
  });
  
  // Create orchestrator instance
  const orchestrator = new MCPLiteOrchestrator(
    octokit,
    payload.repository.owner.login,
    payload.repository.name,
    payload.issue.number
  );
  
  // Process request asynchronously
  orchestrator.processRequest(payload.issue.body || '').catch(error => {
    console.error('Error processing request:', error);
    octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: `❌ Error processing request: ${error.message}`
    });
  });
}

// Handle issue comment event
async function handleIssueComment(payload) {
  if (payload.comment.body.includes('APPROVED')) {
    // Import Octokit dynamically
    const { Octokit } = await import('octokit');
    const { createAppAuth } = await import('@octokit/auth-app');
    
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: parseInt(process.env.GITHUB_APP_ID),
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
        installationId: payload.installation.id
      }
    });
    
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: '✅ Project completed successfully!'
    });
  }
}

// Default route  
app.get('/', (req, res) => {
  res.json({
    name: 'MCP-LITE V2.5 GitHub App',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      health: '/health',
      webhooks: '/api/github/webhooks'
    },
    documentation: 'https://github.com/AnFrIT/mcp-lite-github-app'
  });
});

// Export for Vercel
module.exports = app;