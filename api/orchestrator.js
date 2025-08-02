const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class MCPLiteOrchestrator {
  constructor(octokit, owner, repo, issueNumber) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
    this.issueNumber = issueNumber;
    this.projectBranch = `project-${issueNumber}`;
  }
  
  async processRequest(requirements) {
    console.log(`Starting processing for issue #${this.issueNumber}`);
    
    try {
      // Update issue to show we're processing
      await this.updateIssue('🚀 MCP-LITE V2.5 Starting...');
      
      // ФАЗА 1: Анализ и создание плана
      await this.updateIssue('📋 Phase 1: Project Analysis');
      const plan = await this.phase1_createPlan(requirements);
      
      // ФАЗА 2: Research
      await this.updateIssue('🔍 Phase 2: Research Phase');
      const research = await this.phase2_research(plan);
      
      // ФАЗА 3: Разработка на основе research
      await this.updateIssue('📝 Phase 3: Creating Development Plan');
      const devPlan = await this.phase3_createDevPlan(plan, research);
      
      // ФАЗА 4: Параллельная разработка
      await this.updateIssue('🛠️ Phase 4: Development');
      await this.phase4_development(devPlan);
      
      // ФАЗА 5: Верификация и итерации
      await this.updateIssue('✅ Phase 5: Verification');
      await this.phase5_verification();
      
      // ФАЗА 6: Финальный отчет
      await this.updateIssue('📊 Phase 6: Final Report');
      await this.phase6_finalReport();
      
      await this.updateIssue('✨ Project completed successfully!');
    } catch (error) {
      console.error('Error in processRequest:', error);
      await this.updateIssue(`❌ Error: ${error.message}`);
      throw error;
    }
  }
  
  async phase1_createPlan(requirements) {
    let planQuality = 0;
    let iteration = 0;
    let currentPlan = '';
    
    while (planQuality < 95 && iteration < 5) {
      console.log(`Plan iteration ${iteration + 1}`);
      
      // Create plan using Claude through direct command
      const planPrompt = `As project-analyzer, create a detailed implementation plan for: ${requirements}
        
${iteration > 0 ? `Previous plan had quality score ${planQuality}%. Improve it.` : ''}
        
Include:
1. Technology stack with justification
2. Component breakdown  
3. List of required researchers
4. List of required developers
5. List of required verifiers
6. Success criteria
7. Estimated complexity
        
Format as structured JSON.`;
      
      currentPlan = await this.callClaude(planPrompt);
      
      // Save plan to repository
      await this.saveToRepo(
        `plans/iteration-${iteration}.json`,
        currentPlan,
        `Plan iteration ${iteration + 1}`
      );
      
      // Verify plan
      const verificationPrompt = `As verification-coordinator, analyze this plan for quality:
        
${currentPlan}
        
Rate from 0-100 and return JSON: {"score": NUMBER, "issues": []}`;
      
      const verification = await this.callClaude(verificationPrompt);
      
      try {
        const result = JSON.parse(verification);
        planQuality = result.score || 0;
      } catch (e) {
        planQuality = 0;
      }
      
      console.log(`Plan quality: ${planQuality}%`);
      iteration++;
    }
    
    return JSON.parse(currentPlan);
  }
  
  async phase2_research(plan) {
    console.log('Starting research phase');
    
    // Create research tasks
    const researchResults = {};
    
    for (const researcher of plan.researchers || ['web-technology-researcher']) {
      const researchPrompt = `As ${researcher}, research based on this plan:
        
${JSON.stringify(plan, null, 2)}
        
Find best practices, code examples, and recommendations.
Return results as JSON.`;
      
      const result = await this.callClaude(researchPrompt);
      researchResults[researcher] = JSON.parse(result);
    }
    
    // Verify research quality
    let researchQuality = 0;
    let iteration = 0;
    
    while (researchQuality < 95 && iteration < 3) {
      const verifyPrompt = `As verification-coordinator, verify this research:
        
${JSON.stringify(researchResults, null, 2)}
        
Return JSON: {"score": NUMBER, "improvements": []}`;
      
      const verification = await this.callClaude(verifyPrompt);
      
      try {
        const result = JSON.parse(verification);
        researchQuality = result.score || 0;
        
        if (researchQuality < 95 && result.improvements) {
          // Apply improvements
          for (const improvement of result.improvements) {
            if (improvement.researcher && improvement.suggestion) {
              const improvePrompt = `As ${improvement.researcher}, improve your research:
${improvement.suggestion}
Return improved research as JSON.`;
              
              researchResults[improvement.researcher] = JSON.parse(
                await this.callClaude(improvePrompt)
              );
            }
          }
        }
      } catch (e) {
        researchQuality = 0;
      }
      
      iteration++;
    }
    
    return researchResults;
  }
  
  async phase3_createDevPlan(originalPlan, research) {
    console.log('Creating development plan based on research');
    
    const devPlanPrompt = `As project-analyzer, create development plan based on research.
      
Original requirements: ${originalPlan.requirements}
Research findings: ${JSON.stringify(research, null, 2)}
      
Create detailed development plan with:
1. Exact file structure
2. Code patterns to use
3. Component dependencies
4. Integration points
      
Return as JSON.`;
    
    let devPlan = await this.callClaude(devPlanPrompt);
    
    // Verify dev plan
    let planQuality = 0;
    let iteration = 0;
    
    while (planQuality < 95 && iteration < 3) {
      const verifyPrompt = `As verification-coordinator, verify this development plan:
        
${devPlan}
        
Return JSON: {"score": NUMBER, "issues": []}`;
      
      const verification = await this.callClaude(verifyPrompt);
      
      try {
        const result = JSON.parse(verification);
        planQuality = result.score || 0;
        
        if (planQuality < 95) {
          const improvePrompt = `As project-analyzer, improve the development plan:
Issues found: ${JSON.stringify(result.issues)}
Current plan: ${devPlan}
Return improved plan as JSON.`;
          
          devPlan = await this.callClaude(improvePrompt);
        }
      } catch (e) {
        planQuality = 0;
      }
      
      iteration++;
    }
    
    return JSON.parse(devPlan);
  }
  
  async phase4_development(devPlan) {
    console.log('Starting development phase');
    
    // Create project branch
    await this.createBranch(this.projectBranch);
    
    // Develop each component
    for (const component of devPlan.components || []) {
      const devPrompt = `As ${component.developer || 'fullstack-developer'}, implement ${component.name}.
        
Use this development plan:
${JSON.stringify(component, null, 2)}
        
Requirements:
- Production-ready code
- No placeholders
- Comprehensive error handling
- Tests included
        
Create all necessary files.`;
      
      await this.callClaudeWithFiles(devPrompt, this.projectBranch);
      
      // Commit component
      await this.commitChanges(
        `Implement ${component.name} component`,
        this.projectBranch
      );
    }
  }
  
  async phase5_verification() {
    console.log('Starting verification phase');
    
    let overallQuality = 0;
    let iteration = 0;
    
    while (overallQuality < 95 && iteration < 5) {
      const verifiers = [
        'code-quality-verifier',
        'security-verifier',
        'performance-verifier'
      ];
      
      const verificationResults = [];
      
      for (const verifier of verifiers) {
        const verifyPrompt = `As ${verifier}, verify the code in branch ${this.projectBranch}.
          
Check all aspects relevant to your expertise.
Return JSON: {"score": NUMBER, "issues": [], "fixes": []}`;
        
        const result = await this.callClaude(verifyPrompt);
        verificationResults.push(JSON.parse(result));
      }
      
      // Calculate overall quality
      overallQuality = verificationResults.reduce((acc, v) => acc + v.score, 0) / verificationResults.length;
      
      console.log(`Iteration ${iteration + 1}: Quality ${overallQuality}%`);
      
      if (overallQuality < 95) {
        // Apply fixes
        for (const verification of verificationResults) {
          if (verification.fixes && verification.fixes.length > 0) {
            const fixPrompt = `As verification-iterator, apply these fixes:
${JSON.stringify(verification.fixes, null, 2)}
Fix all issues found.`;
            
            await this.callClaudeWithFiles(fixPrompt, this.projectBranch);
          }
        }
        
        await this.commitChanges(
          `Apply verification fixes - iteration ${iteration + 1}`,
          this.projectBranch
        );
      }
      
      iteration++;
    }
  }
  
  async phase6_finalReport() {
    console.log('Generating final report');
    
    const reportPrompt = `As report-generator, create comprehensive project report.
      
Include:
1. Executive summary
2. Requirements analysis
3. Technology choices
4. Development process
5. Quality metrics
6. Lessons learned
      
Format as professional documentation.`;
    
    const report = await this.callClaude(reportPrompt);
    
    await this.saveToRepo(
      `reports/project-${this.issueNumber}.md`,
      report,
      'Final project report'
    );
    
    // Create PR
    await this.createPullRequest();
  }
  
  // Helper methods
  
  async updateIssue(message) {
    await this.octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner: this.owner,
      repo: this.repo,
      issue_number: this.issueNumber,
      body: message
    });
  }
  
  async callClaude(prompt) {
    // Use Claude Code OAuth token to call Claude
    // This is a simplified version - in production would use proper SDK
    const response = await execAsync(`claude "${prompt.replace(/"/g, '\\"')}"`, {
      env: {
        ...process.env,
        CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN
      }
    });
    
    return response.stdout;
  }
  
  async callClaudeWithFiles(prompt, branch) {
    // Switch to branch and call Claude
    await execAsync(`git checkout ${branch}`);
    return await this.callClaude(prompt);
  }
  
  async saveToRepo(filePath, content, message) {
    try {
      // Get current file (if exists)
      let sha;
      try {
        const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner: this.owner,
          repo: this.repo,
          path: filePath,
          ref: this.projectBranch
        });
        sha = data.sha;
      } catch (e) {
        // File doesn't exist
      }
      
      // Create or update file
      await this.octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        message: message,
        content: Buffer.from(content).toString('base64'),
        branch: this.projectBranch,
        ...(sha && { sha })
      });
    } catch (error) {
      console.error('Error saving to repo:', error);
      throw error;
    }
  }
  
  async createBranch(branchName) {
    try {
      // Get default branch ref
      const { data: ref } = await this.octokit.request('GET /repos/{owner}/{repo}/git/ref/heads/{ref}', {
        owner: this.owner,
        repo: this.repo,
        ref: 'main'
      });
      
      // Create new branch
      await this.octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha
      });
    } catch (error) {
      if (error.status === 422) {
        // Branch already exists
        console.log(`Branch ${branchName} already exists`);
      } else {
        throw error;
      }
    }
  }
  
  async commitChanges(message, branch) {
    try {
      // This would be done through git commands in real implementation
      console.log(`Committing: ${message} to ${branch}`);
    } catch (error) {
      console.error('Error committing changes:', error);
      throw error;
    }
  }
  
  async createPullRequest() {
    try {
      const { data: pr } = await this.octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner: this.owner,
        repo: this.repo,
        title: `MCP-LITE V2.5: Implementation for #${this.issueNumber}`,
        body: `Automated implementation by MCP-LITE V2.5 system.\n\nCloses #${this.issueNumber}`,
        head: this.projectBranch,
        base: 'main'
      });
      
      await this.updateIssue(`📦 Pull Request created: #${pr.number}`);
    } catch (error) {
      console.error('Error creating PR:', error);
      throw error;
    }
  }
}

module.exports = { MCPLiteOrchestrator };