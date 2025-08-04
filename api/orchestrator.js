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
    console.log('Starting parallel research phase');
    
    // Save plan for GitHub Actions
    await this.saveToRepo(
      'plans/final-plan.json',
      JSON.stringify(plan, null, 2),
      'Save plan for research phase'
    );
    
    try {
      // Trigger GitHub Actions workflow for parallel research
      const { data: workflow } = await this.octokit.request(
        'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
        {
          owner: this.owner,
          repo: this.repo,
          workflow_id: 'research.yml',
          ref: this.projectBranch,
          inputs: {
            researchers: JSON.stringify(plan.researchers || ['web-technology-researcher']),
            plan_path: 'plans/final-plan.json',
            issue_number: String(this.issueNumber)
          }
        }
      );
      
      await this.updateIssue('🔬 Triggered parallel research workflow');
      
      // Wait for workflow to complete
      await this.waitForWorkflowCompletion('research');
      
      // Collect research results from artifacts
      const researchResults = await this.collectWorkflowArtifacts('research');
      
      // Verify research quality with iterations
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
            await this.updateIssue(`🔄 Research quality: ${researchQuality}%, applying improvements...`);
            
            // Re-run specific researchers with improvements
            for (const improvement of result.improvements) {
              if (improvement.researcher && improvement.suggestion) {
                // Trigger single researcher with improvement suggestion
                await this.triggerSingleResearcher(improvement.researcher, improvement.suggestion);
              }
            }
            
            // Collect updated results
            researchResults = await this.collectWorkflowArtifacts('research');
          }
        } catch (e) {
          researchQuality = 0;
        }
        
        iteration++;
      }
      
      return researchResults;
      
    } catch (error) {
      // Fallback to sequential if GitHub Actions not available
      console.error('GitHub Actions not available, using sequential research:', error);
      
      const researchResults = {};
      
      for (const researcher of plan.researchers || ['web-technology-researcher']) {
        const researchPrompt = `As ${researcher}, research based on this plan:
          
${JSON.stringify(plan, null, 2)}
          
Find best practices, code examples, and recommendations.
Return results as JSON.`;
        
        const result = await this.callClaude(researchPrompt);
        researchResults[researcher] = JSON.parse(result);
      }
      
      return researchResults;
    }
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
    console.log('Starting parallel development phase');
    
    // Create project branch
    await this.createBranch(this.projectBranch);
    
    // Save development plan for GitHub Actions
    await this.saveToRepo(
      'plans/development-plan.json',
      JSON.stringify(devPlan, null, 2),
      'Save development plan for parallel execution'
    );
    
    // Trigger GitHub Actions workflow for parallel development
    try {
      const { data: workflow } = await this.octokit.request(
        'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
        {
          owner: this.owner,
          repo: this.repo,
          workflow_id: 'development.yml',
          ref: this.projectBranch,
          inputs: {
            components: JSON.stringify(devPlan.components || []),
            developers: JSON.stringify(devPlan.developers || []),
            issue_number: String(this.issueNumber)
          }
        }
      );
      
      await this.updateIssue('🚀 Triggered parallel development workflow');
      
      // Wait for workflow to complete
      await this.waitForWorkflowCompletion('development');
      
    } catch (error) {
      // If GitHub Actions is not available, fall back to sequential development
      console.error('GitHub Actions not available, using sequential development:', error);
      
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
        
        await this.commitChanges(
          `Implement ${component.name} component`,
          this.projectBranch
        );
      }
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
    // Create comment with @claude mention
    const comment = await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: this.issueNumber,
      body: `@claude ${prompt}`
    });
    
    console.log(`Created @claude comment at ${comment.data.created_at}`);
    
    // Wait for Claude's response (polling)
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes maximum
    const pollInterval = 10000; // 10 seconds
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      // Get recent comments
      const { data: comments } = await this.octokit.issues.listComments({
        owner: this.owner,
        repo: this.repo,
        issue_number: this.issueNumber,
        since: comment.data.created_at,
        per_page: 100
      });
      
      // Look for Claude's response
      const claudeResponse = comments.find(c => {
        // Claude bot might have different usernames
        const isClaudeBot = c.user.login.includes('claude') || 
                           c.user.type === 'Bot' && 
                           (c.user.login.includes('anthropic') || 
                            c.user.login.includes('claude'));
        
        // Must be after our comment
        const isAfterOurComment = new Date(c.created_at) > new Date(comment.data.created_at);
        
        return isClaudeBot && isAfterOurComment;
      });
      
      if (claudeResponse) {
        console.log(`Got Claude response after ${attempts + 1} attempts`);
        return claudeResponse.body;
      }
      
      attempts++;
      console.log(`Waiting for Claude response... (attempt ${attempts}/${maxAttempts})`);
    }
    
    throw new Error(`Claude did not respond within ${maxAttempts * pollInterval / 1000} seconds`);
  }
  
  async callClaudeWithFiles(prompt, branch) {
    // Include branch context in the prompt
    const enhancedPrompt = `[Context: Working on branch '${branch}' in repository ${this.owner}/${this.repo}]\n\n${prompt}`;
    
    // Call Claude with enhanced prompt
    return await this.callClaude(enhancedPrompt);
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
    // Since we're on Vercel, we can't use git commands
    // Instead, we'll trigger a GitHub Action to commit changes
    await this.updateIssue(`📝 Triggering commit: "${message}" on branch ${branch}`);
    
    // Trigger GitHub Action workflow for commits
    try {
      await this.octokit.repos.createDispatchEvent({
        owner: this.owner,
        repo: this.repo,
        event_type: 'commit-changes',
        client_payload: {
          branch: branch,
          message: message,
          issue_number: this.issueNumber
        }
      });
      
      console.log(`Triggered commit workflow for: ${message}`);
      return `workflow-${Date.now()}`;
    } catch (error) {
      console.error('Error triggering commit workflow:', error);
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
  
  async waitForWorkflowCompletion(workflowName) {
    console.log(`Waiting for ${workflowName} workflow to complete...`);
    
    const maxWaitTime = 30 * 60 * 1000; // 30 minutes
    const checkInterval = 30 * 1000; // 30 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Get latest workflow runs
        const { data: runs } = await this.octokit.request(
          'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs',
          {
            owner: this.owner,
            repo: this.repo,
            workflow_id: `${workflowName}.yml`,
            branch: this.projectBranch,
            per_page: 1
          }
        );
        
        if (runs.workflow_runs.length > 0) {
          const latestRun = runs.workflow_runs[0];
          
          if (latestRun.status === 'completed') {
            if (latestRun.conclusion === 'success') {
              console.log(`${workflowName} workflow completed successfully`);
              return;
            } else {
              throw new Error(`${workflowName} workflow failed with conclusion: ${latestRun.conclusion}`);
            }
          }
          
          console.log(`Workflow status: ${latestRun.status}`);
        }
      } catch (error) {
        console.error(`Error checking workflow status: ${error.message}`);
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`${workflowName} workflow did not complete within ${maxWaitTime / 1000 / 60} minutes`);
  }
  
  async collectWorkflowArtifacts(workflowName) {
    try {
      // Get artifacts from the latest workflow run
      const { data: runs } = await this.octokit.request(
        'GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs',
        {
          owner: this.owner,
          repo: this.repo,
          workflow_id: `${workflowName}.yml`,
          branch: this.projectBranch,
          per_page: 1
        }
      );
      
      if (runs.workflow_runs.length === 0) {
        throw new Error(`No workflow runs found for ${workflowName}`);
      }
      
      const runId = runs.workflow_runs[0].id;
      
      // Get artifacts
      const { data: artifacts } = await this.octokit.request(
        'GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts',
        {
          owner: this.owner,
          repo: this.repo,
          run_id: runId
        }
      );
      
      const results = {};
      
      // Download and parse each artifact
      for (const artifact of artifacts.artifacts) {
        const { data: download } = await this.octokit.request(
          'GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}',
          {
            owner: this.owner,
            repo: this.repo,
            artifact_id: artifact.id,
            archive_format: 'zip'
          }
        );
        
        // Download artifact data
        const artifactData = await this.downloadArtifact(artifact.id);
        const artifactName = artifact.name.replace('-results', '');
        results[artifactName] = artifactData;
      }
      
      return results;
    } catch (error) {
      console.error('Error collecting artifacts:', error);
      // Fallback: read from repository
      return await this.readResultsFromRepo(workflowName);
    }
  }
  
  async readResultsFromRepo(workflowName) {
    const results = {};
    const resultsPath = `${workflowName}/`;
    
    try {
      const { data: contents } = await this.octokit.request(
        'GET /repos/{owner}/{repo}/contents/{path}',
        {
          owner: this.owner,
          repo: this.repo,
          path: resultsPath,
          ref: this.projectBranch
        }
      );
      
      for (const file of contents) {
        if (file.type === 'file' && file.name.endsWith('.json')) {
          const { data: fileContent } = await this.octokit.request(
            'GET /repos/{owner}/{repo}/contents/{path}',
            {
              owner: this.owner,
              repo: this.repo,
              path: file.path,
              ref: this.projectBranch
            }
          );
          
          const content = Buffer.from(fileContent.content, 'base64').toString();
          const key = file.name.replace('-results.json', '');
          results[key] = JSON.parse(content);
        }
      }
    } catch (error) {
      console.error('Error reading results from repo:', error);
    }
    
    return results;
  }
  
  async triggerSingleResearcher(researcher, improvement) {
    try {
      // Create improvement task file
      await this.saveToRepo(
        `improvements/${researcher}-improvement.md`,
        improvement,
        `Improvement task for ${researcher}`
      );
      
      // Trigger single researcher workflow
      await this.octokit.request(
        'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
        {
          owner: this.owner,
          repo: this.repo,
          workflow_id: 'research.yml',
          ref: this.projectBranch,
          inputs: {
            researchers: JSON.stringify([researcher]),
            plan_path: 'plans/final-plan.json',
            issue_number: String(this.issueNumber),
            improvement_mode: 'true'
          }
        }
      );
      
      // Wait for completion
      await this.waitForWorkflowCompletion('research');
    } catch (error) {
      console.error('Error triggering single researcher:', error);
    }
  }
  
  async downloadArtifact(artifactId) {
    try {
      // Download artifact as zip
      const { data } = await this.octokit.request(
        'GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}',
        {
          owner: this.owner,
          repo: this.repo,
          artifact_id: artifactId,
          archive_format: 'zip'
        }
      );
      
      // Create temporary file
      const tempFile = `/tmp/artifact-${artifactId}.zip`;
      await fs.writeFile(tempFile, Buffer.from(data));
      
      // Extract zip using command line
      const extractDir = `/tmp/artifact-${artifactId}`;
      await execAsync(`mkdir -p ${extractDir} && unzip -o ${tempFile} -d ${extractDir}`);
      
      // Read JSON files from extracted directory
      const files = await fs.readdir(extractDir);
      const results = {};
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(extractDir, file), 'utf8');
          const key = file.replace('.json', '');
          results[key] = JSON.parse(content);
        }
      }
      
      // Cleanup
      await execAsync(`rm -rf ${tempFile} ${extractDir}`);
      
      return results;
    } catch (error) {
      console.error('Error downloading artifact:', error);
      return {};
    }
  }
}

module.exports = { MCPLiteOrchestrator };