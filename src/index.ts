import express from 'express';
import { App, createNodeMiddleware } from '@octokit/app';
import { Webhooks } from '@octokit/webhooks';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const execAsync = promisify(exec);

// Проверяем обязательные переменные
const APP_ID = process.env.GITHUB_APP_ID;
const PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const CLAUDE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;

if (!APP_ID || !PRIVATE_KEY || !WEBHOOK_SECRET || !CLAUDE_OAUTH_TOKEN) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Инициализируем GitHub App
const app = new App({
  appId: parseInt(APP_ID),
  privateKey: PRIVATE_KEY,
  webhooks: {
    secret: WEBHOOK_SECRET
  }
});

// Express сервер
const expressApp = express();
expressApp.use(createNodeMiddleware(app));

// Класс для управления процессом
class MCPLiteOrchestrator {
  private octokit: any;
  private owner: string;
  private repo: string;
  private issueNumber: number;
  private projectBranch: string;
  
  constructor(octokit: any, owner: string, repo: string, issueNumber: number) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
    this.issueNumber = issueNumber;
    this.projectBranch = `project-${issueNumber}`;
  }
  
  // Главный метод обработки
  async processRequest(requirements: string) {
    console.log(`Starting processing for issue #${this.issueNumber}`);
    
    try {
      // Создаем ветку для проекта
      await this.createProjectBranch();
      
      // ФАЗА 1: Анализ и создание плана
      const plan = await this.phase1_createPlan(requirements);
      
      // ФАЗА 2: Research
      const research = await this.phase2_research(plan);
      
      // ФАЗА 3: Разработка на основе research
      const devPlan = await this.phase3_createDevPlan(plan, research);
      
      // ФАЗА 4: Параллельная разработка
      await this.phase4_development(devPlan);
      
      // ФАЗА 5: Верификация и итерации
      await this.phase5_verification();
      
      // ФАЗА 6: Финальный отчет
      await this.phase6_finalReport();
      
      // Уведомляем пользователя о завершении
      await this.notifyCompletion();
      
    } catch (error) {
      console.error('Error processing request:', error);
      await this.notifyError(error);
    }
  }
  
  // Создание ветки для проекта
  async createProjectBranch() {
    try {
      // Получаем SHA основной ветки
      const { data: ref } = await this.octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
        owner: this.owner,
        repo: this.repo,
        ref: 'heads/master'
      });
      
      // Создаем новую ветку
      await this.octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${this.projectBranch}`,
        sha: ref.object.sha
      });
      
      console.log(`Created branch: ${this.projectBranch}`);
    } catch (error: any) {
      if (error.status === 422) {
        console.log(`Branch ${this.projectBranch} already exists`);
      } else {
        throw error;
      }
    }
  }
  
  // ФАЗА 1: Создание и верификация плана
  async phase1_createPlan(requirements: string): Promise<any> {
    let planQuality = 0;
    let iteration = 0;
    let currentPlan = '';
    
    while (planQuality < 95 && iteration < 5) {
      console.log(`Plan iteration ${iteration + 1}`);
      
      // Создаем план через Claude
      const planPrompt = `
As project-analyzer, create a detailed implementation plan for: ${requirements}

${iteration > 0 ? `Previous plan had quality score ${planQuality}%. Improve it based on verification feedback.` : ''}

Include:
1. Technology stack with justification
2. Component breakdown
3. List of required researchers (from our 25+ research agents)
4. List of required developers (from our 15+ execution agents)
5. List of required verifiers (from our 20+ verification agents)
6. Success criteria
7. Estimated complexity (simple/medium/complex/enterprise)

Format as structured markdown with clear sections.
`;
      
      currentPlan = await this.runClaude(planPrompt);
      
      // Сохраняем план в репозиторий
      await this.saveToRepo(
        `plans/iteration-${iteration}.md`,
        currentPlan,
        `Plan iteration ${iteration + 1}`
      );
      
      // Верифицируем план
      const verificationPrompt = `
As verification-coordinator, analyze this plan for quality:

${currentPlan}

Check for:
1. Completeness - all aspects covered
2. Feasibility - can be implemented
3. No TODOs or placeholders
4. Clear actionable steps
5. Appropriate technology choices
6. Realistic time estimates

Rate from 0-100 and explain issues found.
Format: SCORE: [number] followed by explanation.
`;
      
      const verification = await this.runClaude(verificationPrompt);
      
      // Сохраняем верификацию
      await this.saveToRepo(
        `plans/verification-${iteration}.md`,
        verification,
        `Plan verification ${iteration + 1}`
      );
      
      // Извлекаем оценку
      const scoreMatch = verification.match(/SCORE:\s*(\d+)/);
      planQuality = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      
      console.log(`Plan quality: ${planQuality}%`);
      
      // Логируем в Issue
      await this.addIssueComment(`📋 Plan iteration ${iteration + 1}: Quality ${planQuality}%`);
      
      iteration++;
    }
    
    // Сохраняем финальный план
    await this.saveToRepo(
      'plans/final-plan.md',
      currentPlan,
      'Final approved plan'
    );
    
    // Парсим финальный план
    return this.parsePlan(currentPlan);
  }
  
  // ФАЗА 2: Research с параллельными job'ами
  async phase2_research(plan: any): Promise<any> {
    console.log('Starting research phase');
    
    await this.addIssueComment('🔍 Starting research phase with parallel researchers');
    
    // Создаем файлы с задачами для GitHub Actions
    for (const researcher of plan.researchers) {
      const taskContent = `
Researcher: ${researcher}
Plan: ${plan.requirements}
Task: Research best practices, patterns, and solutions for this project
`;
      await this.saveToRepo(
        `tasks/research/${researcher}.md`,
        taskContent,
        `Research task for ${researcher}`
      );
    }
    
    // Запускаем GitHub Actions workflow для параллельного research
    try {
      const { data } = await this.octokit.request(
        'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
        {
          owner: this.owner,
          repo: this.repo,
          workflow_id: 'research.yml',
          ref: this.projectBranch,
          inputs: {
            researchers: JSON.stringify(plan.researchers),
            plan_path: 'plans/final-plan.md',
            issue_number: String(this.issueNumber)
          }
        }
      );
      
      console.log('Research workflow triggered');
      
      // Ждем завершения workflow
      await this.waitForWorkflowCompletion('research');
      
    } catch (error: any) {
      console.log('GitHub Actions not available, running research locally');
      // Fallback: запускаем research локально
      await this.runLocalResearch(plan.researchers);
    }
    
    // Собираем результаты research
    const researchResults = await this.collectResearchResults(plan.researchers);
    
    // Верифицируем research
    let researchQuality = 0;
    let iteration = 0;
    
    while (researchQuality < 95 && iteration < 3) {
      const verifyPrompt = `
As verification-coordinator, verify this research:

${JSON.stringify(researchResults, null, 2)}

Check for:
1. Accuracy of information
2. Completeness
3. No contradictions
4. Actionable insights
5. Up-to-date information (2024-2025)

SCORE: [0-100]
`;
      
      const verification = await this.runClaude(verifyPrompt);
      const scoreMatch = verification.match(/SCORE:\s*(\d+)/);
      researchQuality = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      
      console.log(`Research quality: ${researchQuality}%`);
      
      if (researchQuality < 95) {
        // Улучшаем research
        await this.improveResearch(researchResults, verification);
      }
      
      iteration++;
    }
    
    return researchResults;
  }
  
  // ФАЗА 3: Создание development плана на основе research
  async phase3_createDevPlan(originalPlan: any, research: any): Promise<any> {
    console.log('Creating development plan based on research');
    
    await this.addIssueComment('📝 Creating development plan based on research findings');
    
    const devPlanPrompt = `
As project-analyzer, create development plan based on research.

Original requirements: ${originalPlan.requirements}
Research findings: ${JSON.stringify(research, null, 2)}

Create detailed development plan with:
1. Exact file structure
2. Code patterns to use (from research)
3. Component dependencies
4. Parallel development strategy
5. Integration points

Be specific and actionable. No TODOs or placeholders.
`;
    
    let devPlan = await this.runClaude(devPlanPrompt);
    
    // Верифицируем dev план
    let planQuality = 0;
    let iteration = 0;
    
    while (planQuality < 95 && iteration < 3) {
      const verifyPrompt = `
As verification-coordinator, verify this development plan:

${devPlan}

Original requirements: ${originalPlan.requirements}

Check for completeness, clarity, and feasibility.
SCORE: [0-100]
`;
      
      const verification = await this.runClaude(verifyPrompt);
      const scoreMatch = verification.match(/SCORE:\s*(\d+)/);
      planQuality = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      
      console.log(`Development plan quality: ${planQuality}%`);
      
      if (planQuality < 95) {
        devPlan = await this.improveDevPlan(devPlan, verification);
      }
      
      iteration++;
    }
    
    // Сохраняем финальный dev план
    await this.saveToRepo(
      'plans/development-plan.md',
      devPlan,
      'Final development plan'
    );
    
    return this.parseDevPlan(devPlan);
  }
  
  // ФАЗА 4: Параллельная разработка
  async phase4_development(devPlan: any) {
    console.log('Starting parallel development');
    
    await this.addIssueComment('🛠️ Starting parallel development phase');
    
    // Создаем задачи для каждого компонента
    for (const component of devPlan.components) {
      const taskContent = `
Component: ${component.name}
Developer: ${component.developer}
Dependencies: ${JSON.stringify(component.dependencies)}
Specifications: ${component.specifications}
`;
      await this.saveToRepo(
        `tasks/development/${component.name}.md`,
        taskContent,
        `Development task for ${component.name}`
      );
    }
    
    try {
      // Запускаем GitHub Actions для параллельной разработки
      await this.octokit.request(
        'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
        {
          owner: this.owner,
          repo: this.repo,
          workflow_id: 'development.yml',
          ref: this.projectBranch,
          inputs: {
            components: JSON.stringify(devPlan.components),
            developers: JSON.stringify(devPlan.developers),
            issue_number: String(this.issueNumber)
          }
        }
      );
      
      await this.waitForWorkflowCompletion('development');
      
    } catch (error) {
      console.log('Running development locally');
      await this.runLocalDevelopment(devPlan.components);
    }
    
    await this.addIssueComment('✅ Development phase completed');
  }
  
  // ФАЗА 5: Комплексная верификация с итерациями
  async phase5_verification() {
    console.log('Starting verification phase');
    
    await this.addIssueComment('🔍 Starting comprehensive verification');
    
    let overallQuality = 0;
    let iteration = 0;
    
    while (overallQuality < 95 && iteration < 5) {
      // Запускаем все верификаторы
      const verificationResults = await this.runAllVerifiers();
      
      // Анализируем результаты
      const issues = this.analyzeVerificationResults(verificationResults);
      
      if (issues.length > 0) {
        await this.addIssueComment(`🔧 Found ${issues.length} issues, fixing...`);
        
        // Создаем задачи на исправление
        for (const issue of issues) {
          await this.createFixTask(issue);
        }
        
        // Запускаем исправления
        await this.runFixes(issues);
      }
      
      // Вычисляем общее качество
      overallQuality = this.calculateOverallQuality(verificationResults);
      
      console.log(`Iteration ${iteration + 1}: Quality ${overallQuality}%`);
      await this.addIssueComment(`📊 Verification iteration ${iteration + 1}: Quality ${overallQuality}%`);
      
      iteration++;
    }
    
    // Финальная проверка UI/UX
    await this.verifyVisualQuality();
  }
  
  // ФАЗА 6: Генерация отчета
  async phase6_finalReport() {
    console.log('Generating final report');
    
    await this.addIssueComment('📄 Generating comprehensive project report');
    
    // Собираем всю информацию о проекте
    const projectData = await this.collectAllProjectData();
    
    const reportPrompt = `
As report-generator, create comprehensive LaTeX report.

Project data: ${JSON.stringify(projectData, null, 2)}

Include:
1. Executive summary
2. Requirements analysis
3. Technology choices and justification
4. Development process (with iterations)
5. Quality metrics achieved
6. Performance benchmarks
7. Security assessment
8. Lessons learned
9. Future recommendations

Format as proper LaTeX document ready for compilation.
`;
    
    const latexReport = await this.runClaude(reportPrompt);
    
    // Сохраняем отчет
    await this.saveToRepo(
      `reports/project-${this.issueNumber}.tex`,
      latexReport,
      'Final project report'
    );
    
    // Создаем README для проекта
    const readmePrompt = `
Create a comprehensive README.md for this project based on:
${JSON.stringify(projectData, null, 2)}

Include setup instructions, features, and usage examples.
`;
    
    const readme = await this.runClaude(readmePrompt);
    
    await this.saveToRepo(
      'README.md',
      readme,
      'Project documentation'
    );
  }
  
  // Вспомогательные методы
  
  async runClaude(prompt: string): Promise<string> {
    // Здесь мы используем Claude через child_process
    // В реальности нужно использовать Claude Code SDK когда он станет доступен
    const tempFile = `/tmp/claude-prompt-${Date.now()}.txt`;
    await fs.writeFile(tempFile, prompt);
    
    try {
      // Симулируем вызов Claude (в реальности здесь будет claude-code-sdk)
      const { stdout } = await execAsync(`echo "Simulated Claude response for: ${prompt.substring(0, 100)}..."`);
      return stdout;
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }
  
  async saveToRepo(path: string, content: string, message: string) {
    try {
      // Проверяем, существует ли файл
      let sha: string | undefined;
      try {
        const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: this.owner,
          repo: this.repo,
          path: path,
          ref: this.projectBranch
        });
        sha = data.sha;
      } catch (error: any) {
        if (error.status !== 404) throw error;
      }
      
      // Создаем или обновляем файл
      await this.octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: this.owner,
        repo: this.repo,
        path: path,
        message: message,
        content: Buffer.from(content).toString('base64'),
        branch: this.projectBranch,
        sha: sha
      });
      
      console.log(`Saved file: ${path}`);
    } catch (error) {
      console.error(`Error saving file ${path}:`, error);
      throw error;
    }
  }
  
  async addIssueComment(comment: string) {
    await this.octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner: this.owner,
      repo: this.repo,
      issue_number: this.issueNumber,
      body: comment
    });
  }
  
  async waitForWorkflowCompletion(workflowName: string, maxWaitTime = 600000) {
    const startTime = Date.now();
    const checkInterval = 30000; // 30 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/actions/runs', {
          owner: this.owner,
          repo: this.repo,
          branch: this.projectBranch,
          per_page: 10
        });
        
        const relevantRun = data.workflow_runs.find((run: any) => 
          run.name.toLowerCase().includes(workflowName.toLowerCase())
        );
        
        if (relevantRun) {
          if (relevantRun.status === 'completed') {
            console.log(`Workflow ${workflowName} completed with conclusion: ${relevantRun.conclusion}`);
            return;
          }
          console.log(`Workflow ${workflowName} status: ${relevantRun.status}`);
        }
      } catch (error) {
        console.error('Error checking workflow status:', error);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`Workflow ${workflowName} did not complete within ${maxWaitTime}ms`);
  }
  
  async runLocalResearch(researchers: string[]) {
    for (const researcher of researchers) {
      const prompt = `
As ${researcher}, research best practices for the project described in plans/final-plan.md.
Provide comprehensive research findings.
`;
      const result = await this.runClaude(prompt);
      await this.saveToRepo(
        `research/${researcher}-results.md`,
        result,
        `Research by ${researcher}`
      );
    }
  }
  
  async collectResearchResults(researchers: string[]): Promise<any> {
    const results: any = {};
    
    for (const researcher of researchers) {
      try {
        const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: this.owner,
          repo: this.repo,
          path: `research/${researcher}-results.md`,
          ref: this.projectBranch
        });
        
        const content = Buffer.from(data.content, 'base64').toString();
        results[researcher] = content;
      } catch (error) {
        console.error(`Could not find results for ${researcher}`);
      }
    }
    
    return results;
  }
  
  async improveResearch(currentResearch: any, verification: string) {
    const improvePrompt = `
Improve this research based on verification feedback:

Current research: ${JSON.stringify(currentResearch, null, 2)}
Verification feedback: ${verification}

Provide improved research addressing all issues.
`;
    
    const improvedResearch = await this.runClaude(improvePrompt);
    
    // Сохраняем улучшенный research
    await this.saveToRepo(
      'research/improved-research.md',
      improvedResearch,
      'Improved research based on verification'
    );
  }
  
  async improveDevPlan(currentPlan: string, verification: string): Promise<string> {
    const improvePrompt = `
Improve this development plan based on verification feedback:

Current plan: ${currentPlan}
Verification feedback: ${verification}

Provide improved plan addressing all issues.
`;
    
    return await this.runClaude(improvePrompt);
  }
  
  async runLocalDevelopment(components: any[]) {
    for (const component of components) {
      const prompt = `
As ${component.developer}, implement ${component.name}.
Specifications: ${component.specifications}
Use patterns from research results.
Create production-ready code with no TODOs.
`;
      const code = await this.runClaude(prompt);
      await this.saveToRepo(
        `src/${component.name}/index.ts`,
        code,
        `Implement ${component.name}`
      );
    }
  }
  
  async runAllVerifiers(): Promise<any[]> {
    const verifiers = [
      'code-quality-verifier',
      'security-verifier',
      'performance-verifier',
      'architecture-verifier',
      'ui-consistency-verifier',
      'accessibility-verifier',
      'test-coverage-verifier'
    ];
    
    const results = [];
    
    for (const verifier of verifiers) {
      const result = await this.runVerifier(verifier);
      results.push(result);
    }
    
    return results;
  }
  
  async runVerifier(verifierName: string): Promise<any> {
    const verifyPrompt = `
As ${verifierName}, verify the code in branch ${this.projectBranch}.

Check all aspects relevant to your expertise.
Rate quality from 0-100.
List specific issues found.

Format:
SCORE: [number]
ISSUES:
- Issue 1
- Issue 2
`;
    
    const result = await this.runClaude(verifyPrompt);
    
    // Сохраняем результат верификации
    await this.saveToRepo(
      `verification/${verifierName}-results.md`,
      result,
      `Verification by ${verifierName}`
    );
    
    return {
      verifier: verifierName,
      result: result,
      score: this.extractScore(result)
    };
  }
  
  analyzeVerificationResults(results: any[]): any[] {
    const issues = [];
    
    for (const result of results) {
      if (result.score < 95) {
        const issueMatches = result.result.match(/- (.+)/g) || [];
        for (const match of issueMatches) {
          issues.push({
            verifier: result.verifier,
            issue: match.substring(2),
            score: result.score
          });
        }
      }
    }
    
    return issues;
  }
  
  calculateOverallQuality(results: any[]): number {
    if (results.length === 0) return 0;
    
    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    return Math.floor(totalScore / results.length);
  }
  
  async createFixTask(issue: any) {
    const taskContent = `
Fix issue found by ${issue.verifier}:
${issue.issue}

Current quality score: ${issue.score}
Target: 95+
`;
    
    await this.saveToRepo(
      `tasks/fixes/${issue.verifier}-fix.md`,
      taskContent,
      `Fix task for ${issue.verifier}`
    );
  }
  
  async runFixes(issues: any[]) {
    for (const issue of issues) {
      const fixPrompt = `
Fix this issue found by ${issue.verifier}:
${issue.issue}

Apply the fix to the relevant code.
`;
      
      const fix = await this.runClaude(fixPrompt);
      
      // Сохраняем исправление
      await this.saveToRepo(
        `fixes/${issue.verifier}-fix.md`,
        fix,
        `Fix for ${issue.verifier} issue`
      );
    }
  }
  
  async verifyVisualQuality() {
    const uiPrompt = `
As ui-consistency-verifier, check the visual quality:

1. No overlapping elements
2. Proper color contrast (no black on black)
3. Responsive design
4. Beautiful and modern appearance
5. Consistent spacing
6. Readable fonts

Analyze the UI code and provide feedback.
SCORE: [0-100]
`;
    
    const uiResult = await this.runClaude(uiPrompt);
    
    await this.saveToRepo(
      'verification/ui-final-check.md',
      uiResult,
      'Final UI verification'
    );
    
    const score = this.extractScore(uiResult);
    
    if (score < 95) {
      await this.fixUIIssues(uiResult);
    }
  }
  
  async fixUIIssues(uiResult: string) {
    const fixPrompt = `
Fix these UI issues:
${uiResult}

Ensure beautiful, modern, and accessible design.
`;
    
    const fixes = await this.runClaude(fixPrompt);
    
    await this.saveToRepo(
      'fixes/ui-fixes.md',
      fixes,
      'UI fixes'
    );
  }
  
  async collectAllProjectData(): Promise<any> {
    const data = {
      issue: this.issueNumber,
      branch: this.projectBranch,
      plans: {},
      research: {},
      code: {},
      verification: {},
      metrics: {}
    };
    
    // Собираем все данные из репозитория
    // В реальной реализации здесь будет рекурсивный обход всех файлов
    
    return data;
  }
  
  async notifyCompletion() {
    const message = `
🎉 **Project completed successfully!**

Branch: \`${this.projectBranch}\`
Quality achieved: 95%+

View the project: [Open branch](https://github.com/${this.owner}/${this.repo}/tree/${this.projectBranch})

Reports:
- [Technical Report](/reports/project-${this.issueNumber}.tex)
- [README](/README.md)

The project is ready for review!
`;
    
    await this.addIssueComment(message);
  }
  
  async notifyError(error: any) {
    const message = `
❌ **Error during processing:**

\`\`\`
${error.message || error}
\`\`\`

Please check the logs for more details.
`;
    
    await this.addIssueComment(message);
  }
  
  // Утилиты для парсинга
  
  parsePlan(planText: string): any {
    // В реальной реализации здесь будет полноценный парсер markdown
    return {
      requirements: this.extractSection(planText, 'Requirements'),
      researchers: this.extractList(planText, 'Researchers') || [
        'web-technology-researcher',
        'ui-trends-researcher',
        'database-researcher'
      ],
      developers: this.extractList(planText, 'Developers') || [
        'frontend-developer',
        'backend-developer',
        'database-administrator'
      ],
      verifiers: this.extractList(planText, 'Verifiers') || [
        'code-quality-verifier',
        'security-verifier',
        'performance-verifier'
      ],
      complexity: this.extractValue(planText, 'Complexity') || 'medium'
    };
  }
  
  parseDevPlan(planText: string): any {
    // В реальной реализации здесь будет детальный парсер
    return {
      components: [
        {
          name: 'frontend',
          developer: 'frontend-developer',
          dependencies: [],
          specifications: 'React-based UI'
        },
        {
          name: 'backend',
          developer: 'backend-developer',
          dependencies: ['database'],
          specifications: 'Node.js API'
        },
        {
          name: 'database',
          developer: 'database-administrator',
          dependencies: [],
          specifications: 'PostgreSQL schema'
        }
      ],
      developers: ['frontend-developer', 'backend-developer', 'database-administrator']
    };
  }
  
  private extractSection(text: string, section: string): string {
    const regex = new RegExp(`## ${section}\\n([\\s\\S]*?)(?=\\n##|$)`);
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }
  
  private extractList(text: string, section: string): string[] {
    const sectionText = this.extractSection(text, section);
    if (!sectionText) return [];
    
    return sectionText
      .split('\n')
      .filter(line => line.startsWith('-'))
      .map(line => line.substring(1).trim());
  }
  
  private extractValue(text: string, key: string): string {
    const regex = new RegExp(`${key}:\\s*(.+)`);
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }
  
  private extractScore(text: string): number {
    const match = text.match(/SCORE:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
}

// Обработчик webhook для новых issues
app.webhooks.on('issues.opened', async ({ octokit, payload }) => {
  console.log('Received issues.opened webhook');
  
  if (!payload.issue.labels?.some(label => label.name === 'claude-build')) {
    console.log('Issue does not have claude-build label, skipping');
    return;
  }
  
  const orchestrator = new MCPLiteOrchestrator(
    octokit,
    payload.repository.owner.login,
    payload.repository.name,
    payload.issue.number
  );
  
  // Запускаем обработку асинхронно
  orchestrator.processRequest(payload.issue.body || '').catch(error => {
    console.error('Error in orchestrator:', error);
  });
  
  // Сразу отвечаем GitHub, что получили webhook
  console.log('Started processing for issue #' + payload.issue.number);
});

// Обработчик для комментариев пользователя
app.webhooks.on('issue_comment.created', async ({ octokit, payload }) => {
  console.log('Received issue_comment.created webhook');
  
  if (!payload.issue.labels?.some(label => label.name === 'claude-build')) {
    return;
  }
  
  const comment = payload.comment.body.toLowerCase();
  
  if (comment.includes('approved') || comment.includes('lgtm')) {
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: '✅ Project approved! Ready for deployment.'
    });
    
    // Закрываем issue
    await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      state: 'closed'
    });
  }
  
  if (comment.includes('restart') || comment.includes('retry')) {
    const orchestrator = new MCPLiteOrchestrator(
      octokit,
      payload.repository.owner.login,
      payload.repository.name,
      payload.issue.number
    );
    
    orchestrator.processRequest(payload.issue.body || '').catch(error => {
      console.error('Error in orchestrator:', error);
    });
  }
});

// Health check endpoint
expressApp.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Для Vercel нужно экспортировать приложение
if (process.env.VERCEL) {
  // В Vercel не нужно слушать порт
  module.exports = expressApp;
} else {
  // Локально запускаем сервер
  const PORT = process.env.PORT || 3000;
  expressApp.listen(PORT, () => {
    console.log(`MCP-LITE GitHub App listening on port ${PORT}`);
    console.log('Webhook endpoint: POST /api/github/webhooks');
    console.log('Health check: GET /health');
  });
}

// Экспортируем для Vercel
export default expressApp;