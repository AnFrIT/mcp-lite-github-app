# MCP-LITE GitHub App

This is the GitHub App component for MCP-LITE V2.5 - an intelligent development automation system.

## Features

- Automated project planning with quality verification
- Parallel research phase with 25+ specialized agents
- Parallel development with automatic code generation
- Iterative verification until 95%+ quality achieved
- Comprehensive LaTeX report generation
- Full project automation from Issue to Pull Request

## Setup

1. Create a GitHub App at https://github.com/settings/apps/new

2. Configure the GitHub App:
   - Webhook URL: `https://your-app.vercel.app/api/github/webhooks`
   - Permissions: Issues (Write), Contents (Write), Actions (Write), Pull Requests (Write)
   - Subscribe to events: Issues, Issue comments, Pull requests

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create `.env` file with your credentials:
   ```
   GITHUB_APP_ID=your_app_id
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
   your_private_key_here
   -----END RSA PRIVATE KEY-----"
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   CLAUDE_CODE_OAUTH_TOKEN=your_claude_oauth_token
   ```

5. Build the project:
   ```bash
   npm run build
   ```

6. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

## Usage

1. Install the GitHub App in your repository
2. Create an issue with the `claude-build` label
3. The system will automatically process your request

## Development

Run locally:
```bash
npm run dev
```

## Architecture

The system uses:
- GitHub Webhooks for triggering
- GitHub Actions for parallel execution
- Claude Code for AI-powered development
- Iterative verification for quality assurance

## License

MIT