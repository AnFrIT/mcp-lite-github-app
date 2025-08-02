// Build TypeScript if needed
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Check if dist exists, if not build it
  const distPath = path.join(__dirname, '../dist');
  if (!fs.existsSync(distPath)) {
    console.log('Building TypeScript...');
    execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  }

  // Import the Express app from compiled TypeScript
  const distIndexPath = path.join(__dirname, '../dist/index.js');
  console.log('Loading from:', distIndexPath);
  
  const module = require(distIndexPath);
  const app = module.default || module.expressApp || module;
  
  console.log('App type:', typeof app);
  console.log('App keys:', Object.keys(app));
  
  // Export for Vercel
  module.exports = app;
} catch (error) {
  console.error('Error in api/index.js:', error);
  throw error;
}