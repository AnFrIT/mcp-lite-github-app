// Build TypeScript if needed
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if dist exists, if not build it
const distPath = path.join(__dirname, '../dist');
if (!fs.existsSync(distPath)) {
  console.log('Building TypeScript...');
  execSync('npm run build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
}

// Re-export the compiled TypeScript
module.exports = require('../dist/index.js').default || require('../dist/index.js');