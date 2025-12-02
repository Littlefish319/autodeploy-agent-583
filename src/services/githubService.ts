import { FileNode, SavedProject } from "../types";

const GITHUB_API_BASE = "https://api.github.com";

export const verifyGithubToken = async (token: string): Promise<string> => {
  const response = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!response.ok) throw new Error("Invalid GitHub Token");
  const data = await response.json();
  return data.login;
};

export const createRepository = async (token: string, name: string, description: string) => {
  const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, description, private: false, auto_init: true }),
  });
  if (!response.ok) {
     const err = await response.json();
     // If repo exists, we can try to use it
     if (err.message && err.message.includes("name already exists")) {
         return { name, html_url: `https://github.com/${await verifyGithubToken(token)}/${name}` };
     }
     throw new Error(`GitHub Create Repo Error: ${err.message}`);
  }
  return await response.json();
};

export const pushFilesToRepo = async (token: string, username: string, repoName: string, files: FileNode[], onProgress: (msg: string) => void) => {
  for (const file of files) {
    onProgress(`Pushing ${file.path}...`);
    let sha: string | undefined = undefined;
    try {
        const checkRes = await fetch(`${GITHUB_API_BASE}/repos/${username}/${repoName}/contents/${file.path}`, {
            headers: { Authorization: `token ${token}` }
        });
        if (checkRes.ok) {
            const checkData = await checkRes.json();
            sha = checkData.sha;
        }
    } catch (e) {}

    const contentEncoded = btoa(unescape(encodeURIComponent(file.content)));
    const res = await fetch(`${GITHUB_API_BASE}/repos/${username}/${repoName}/contents/${file.path}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Add ${file.path} via AutoDeploy Agent`,
        content: contentEncoded,
        sha: sha,
      }),
    });
    if (!res.ok) throw new Error(`Failed to upload ${file.path}`);
  }
};