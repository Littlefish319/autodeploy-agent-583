import React, { useState, useEffect } from 'react';
import { Terminal } from './components/Terminal';
import { generateProjectCode } from './services/geminiService';
import { verifyGithubToken, createRepository, pushFilesToRepo } from './services/githubService';
import { createVercelProject } from './services/vercelService';
import { AppConfig, LogEntry, Step, GeneratedProject, FileNode } from './types';
import { Settings, Play, UploadCloud, Github, Code, CheckCircle, Loader2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [step, setStep] = useState<Step>(Step.CONFIG);
  const [config, setConfig] = useState<AppConfig>({
    githubToken: '',
    vercelToken: '',
    githubUsername: '',
    geminiKey: ''
  });
  const [prompt, setPrompt] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [project, setProject] = useState<GeneratedProject | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('autodeploy_config');
    if (saved) {
      setConfig(JSON.parse(saved));
      setStep(Step.PROMPT);
    }
  }, []);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(36), timestamp: new Date(), message, type }]);
  };

  const handleSaveConfig = async () => {
    setIsLoading(true);
    try {
      const username = await verifyGithubToken(config.githubToken);
      const newConfig = { ...config, githubUsername: username };
      setConfig(newConfig);
      localStorage.setItem('autodeploy_config', JSON.stringify(newConfig));
      addLog(`Authenticated as GitHub user: ${username}`, 'success');
      setStep(Step.PROMPT);
    } catch (e: any) {
      addLog(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setStep(Step.GENERATING);
    setIsLoading(true);
    addLog(`Generating project for: "${prompt}"...`, 'info');
    
    try {
      const generated = await generateProjectCode(prompt, 'generate', config.geminiKey);
      setProject(generated);
      addLog(`Generated project: ${generated.name}`, 'success');
      addLog(`Created ${generated.files.length} files.`, 'info');
      setStep(Step.REVIEW);
    } catch (e: any) {
      addLog(e.message, 'error');
      setStep(Step.PROMPT);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!project || !config.githubUsername) return;
    setStep(Step.DEPLOYING);
    setIsLoading(true);
    
    try {
      // 1. Create Repo
      addLog('Creating GitHub repository...', 'info');
      const repo = await createRepository(config.githubToken, project.name, project.description);
      setRepoUrl(repo.html_url);
      addLog(`Repository created: ${repo.html_url}`, 'success');

      // 2. Push Files
      await pushFilesToRepo(config.githubToken, config.githubUsername, project.name, project.files, (msg) => addLog(msg, 'info'));
      addLog('All files pushed to GitHub.', 'success');

      // 3. Deploy to Vercel (if token provided)
      if (config.vercelToken) {
        addLog('Triggering Vercel deployment...', 'info');
        const vercelProject = await createVercelProject(config.vercelToken, project.name, `${config.githubUsername}/${project.name}`);
        addLog('Vercel project created/linked.', 'success');
        setDeploymentUrl(`https://${project.name}.vercel.app`); // Approximation, real URL comes from Vercel API but usually matches name if available
        addLog(`Deployment queued. Visit https://vercel.com/dashboard to see progress.`, 'warning');
      } else {
        addLog('Skipping Vercel deployment (no token provided).', 'warning');
      }

      setStep(Step.SUCCESS);
    } catch (e: any) {
      addLog(e.message, 'error');
      setStep(Step.REVIEW);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-deploy-dark text-white font-sans selection:bg-deploy-accent selection:text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-deploy-border bg-deploy-card/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-deploy-accent rounded-lg flex items-center justify-center">
              <Code className="text-white" size={20} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">AutoDeploy Agent</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", config.githubUsername ? "bg-green-500" : "bg-red-500")} />
              {config.githubUsername || 'Not Connected'}
            </div>
            <button onClick={() => setStep(Step.CONFIG)} className="hover:text-white transition-colors">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel: Controls */}
        <div className="space-y-6">
          {step === Step.CONFIG && (
            <div className="bg-deploy-card border border-deploy-border rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Settings className="text-deploy-accent" /> Configuration
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">GitHub Personal Access Token (Repo Scope)</label>
                  <input 
                    type="password" 
                    value={config.githubToken}
                    onChange={(e) => setConfig({...config, githubToken: e.target.value})}
                    className="w-full bg-black/50 border border-deploy-border rounded-lg p-2.5 focus:border-deploy-accent focus:ring-1 focus:ring-deploy-accent outline-none transition-all"
                    placeholder="ghp_..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Vercel Token (Optional)</label>
                  <input 
                    type="password" 
                    value={config.vercelToken}
                    onChange={(e) => setConfig({...config, vercelToken: e.target.value})}
                    className="w-full bg-black/50 border border-deploy-border rounded-lg p-2.5 focus:border-deploy-accent focus:ring-1 focus:ring-deploy-accent outline-none transition-all"
                    placeholder="..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Gemini API Key (Optional if env set)</label>
                  <input 
                    type="password" 
                    value={config.geminiKey}
                    onChange={(e) => setConfig({...config, geminiKey: e.target.value})}
                    className="w-full bg-black/50 border border-deploy-border rounded-lg p-2.5 focus:border-deploy-accent focus:ring-1 focus:ring-deploy-accent outline-none transition-all"
                    placeholder="AIza..."
                  />
                </div>
                <button 
                  onClick={handleSaveConfig}
                  disabled={isLoading || !config.githubToken}
                  className="w-full bg-deploy-accent hover:bg-blue-600 text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : 'Save & Continue'}
                </button>
              </div>
            </div>
          )}

          {(step === Step.PROMPT || step === Step.GENERATING) && (
            <div className="bg-deploy-card border border-deploy-border rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Play className="text-deploy-accent" /> Project Prompt
              </h2>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-32 bg-black/50 border border-deploy-border rounded-lg p-3 focus:border-deploy-accent focus:ring-1 focus:ring-deploy-accent outline-none resize-none"
                placeholder="Describe the app you want to build (e.g., 'A modern landing page for a coffee shop with a dark theme')..."
              />
              <button 
                onClick={handleGenerate}
                disabled={isLoading || !prompt}
                className="w-full bg-deploy-accent hover:bg-blue-600 text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <><Play size={18} /> Generate Code</>}
              </button>
            </div>
          )}

          {(step === Step.REVIEW || step === Step.DEPLOYING || step === Step.SUCCESS) && project && (
            <div className="bg-deploy-card border border-deploy-border rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <CheckCircle className="text-green-500" /> Review & Deploy
                </h2>
                <button onClick={() => setStep(Step.PROMPT)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                  <RefreshCw size={12} /> Reset
                </button>
              </div>
              
              <div className="bg-black/30 rounded-lg p-4 border border-deploy-border">
                <h3 className="font-bold text-lg mb-1">{project.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{project.description}</p>
                <div className="text-xs font-mono text-gray-500">
                  {project.files.length} files generated ready for deployment.
                </div>
              </div>

              {step === Step.REVIEW && (
                <button 
                  onClick={handleDeploy}
                  disabled={isLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <><UploadCloud size={18} /> Deploy to GitHub & Vercel</>}
                </button>
              )}

              {step === Step.SUCCESS && (
                <div className="space-y-3">
                  {repoUrl && (
                    <a href={repoUrl} target="_blank" rel="noreferrer" className="block w-full bg-[#24292e] hover:bg-[#2f363d] text-white p-3 rounded-lg flex items-center justify-between transition-colors">
                      <span className="flex items-center gap-2"><Github size={18} /> Repository</span>
                      <ArrowRight size={16} />
                    </a>
                  )}
                  {deploymentUrl && (
                    <a href={deploymentUrl} target="_blank" rel="noreferrer" className="block w-full bg-deploy-accent hover:bg-blue-600 text-white p-3 rounded-lg flex items-center justify-between transition-colors">
                      <span className="flex items-center gap-2"><UploadCloud size={18} /> Live Deployment</span>
                      <ArrowRight size={16} />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Terminal */}
        <div className="h-[600px] lg:h-auto">
          <Terminal logs={logs} />
        </div>
      </main>
    </div>
  );
}