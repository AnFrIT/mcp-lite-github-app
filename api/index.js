// Simple test handler for debugging
module.exports = (req, res) => {
  // Log environment to debug
  console.log('Environment check:', {
    hasAppId: !!process.env.GITHUB_APP_ID,
    hasPrivateKey: !!process.env.GITHUB_APP_PRIVATE_KEY,
    hasWebhookSecret: !!process.env.GITHUB_WEBHOOK_SECRET,
    hasClaudeToken: !!process.env.CLAUDE_CODE_OAUTH_TOKEN,
    nodeVersion: process.version,
    cwd: process.cwd(),
    dirname: __dirname
  });

  // Check if it's a health check
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

  // Try to load the real app
  try {
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    
    // Check if dist exists, if not build it
    const distPath = path.join(__dirname, '../dist');
    if (!fs.existsSync(distPath)) {
      console.log('Building TypeScript...');
      execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    }

    // Import the Express app from compiled TypeScript
    const distIndexPath = path.join(__dirname, '../dist/index.js');
    const module = require(distIndexPath);
    const app = module.default || module.expressApp || module;
    
    // Handle the request
    return app(req, res);
  } catch (error) {
    console.error('Error loading app:', error);
    return res.status(500).json({ 
      error: 'Failed to load application',
      message: error.message,
      stack: error.stack
    });
  }
};