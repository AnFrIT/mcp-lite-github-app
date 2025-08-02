const crypto = require('crypto');

module.exports = async (req, res) => {
  // Handle different HTTP methods
  if (req.method === 'GET') {
    if (req.url === '/health') {
      return res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        env: {
          hasAppId: !!process.env.GITHUB_APP_ID,
          hasPrivateKey: !!process.env.GITHUB_APP_PRIVATE_KEY,
          hasWebhookSecret: !!process.env.GITHUB_WEBHOOK_SECRET,
          hasClaudeToken: !!process.env.CLAUDE_CODE_OAUTH_TOKEN
        }
      });
    }
    
    return res.status(200).json({
      name: 'MCP-LITE V2.5 GitHub App',
      version: '1.0.0',
      status: 'operational',
      endpoints: {
        health: '/health',
        webhooks: '/api/github/webhooks'
      },
      documentation: 'https://github.com/AnFrIT/mcp-lite-github-app'
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }
  
  try {
    // Verify webhook signature
    const signature = req.headers['x-hub-signature-256'];
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
    const event = req.headers['x-github-event'];
    console.log(`Received ${event} webhook`);
    
    // Handle different events
    if (event === 'issues' && req.body.action === 'opened') {
      // Check for claude-build label
      if (!req.body.issue.labels?.some(label => label.name === 'claude-build')) {
        console.log('Issue does not have claude-build label, skipping');
        return res.status(200).send('OK - No claude-build label');
      }
      
      console.log(`Processing issue #${req.body.issue.number}: ${req.body.issue.title}`);
      
      // Process asynchronously to avoid timeout
      processIssue(req.body).catch(error => {
        console.error('Error processing issue:', error);
      });
      
      return res.status(200).send('OK - Processing started');
    } else if (event === 'issue_comment' && req.body.action === 'created') {
      if (req.body.comment.body.includes('APPROVED')) {
        processApproval(req.body).catch(error => {
          console.error('Error processing approval:', error);
        });
        return res.status(200).send('OK - Approval processed');
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send(error.message);
  }
};

async function processIssue(payload) {
  try {
    // Dynamic imports for ESM modules
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
    
    // Import orchestrator
    const { MCPLiteOrchestrator } = require('./orchestrator');
    
    // Create orchestrator instance
    const orchestrator = new MCPLiteOrchestrator(
      octokit,
      payload.repository.owner.login,
      payload.repository.name,
      payload.issue.number
    );
    
    // Process request
    await orchestrator.processRequest(payload.issue.body || '');
  } catch (error) {
    console.error('Error in processIssue:', error);
    
    // Try to comment on issue about error
    try {
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
        body: `❌ Error processing request: ${error.message}`
      });
    } catch (commentError) {
      console.error('Error posting error comment:', commentError);
    }
  }
}

async function processApproval(payload) {
  try {
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
  } catch (error) {
    console.error('Error processing approval:', error);
  }
}