const VERCEL_API_BASE = "https://api.vercel.com";
export const createVercelProject = async (vercelToken: string, projectName: string, repoName: string, githubType: string = "github") => {
  try {
    const response = await fetch(`${VERCEL_API_BASE}/v9/projects`, {
      method: "POST",
      headers: { Authorization: `Bearer ${vercelToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: projectName,
        gitRepository: { type: githubType, repo: repoName },
        framework: "vite", 
        buildCommand: "npm run build",
        outputDirectory: "dist",
        serverlessFunctionRegion: "iad1",
      }),
    });
    if (!response.ok) {
        const err = await response.json();
        if (err.code === 'PROJECT_ALREADY_EXISTS') {
            return { name: projectName, html_url: `https://vercel.com/${repoName.split('/')[0]}/${projectName}` };
        }
        throw new Error(err.message || "Failed to create Vercel project");
    }
    return await response.json();
  } catch (e) { throw e; }
};