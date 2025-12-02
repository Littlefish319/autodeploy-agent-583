import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeneratedProject } from "../types";

const getAiClient = (apiKeyOverride?: string) => {
  // Prioritize override, then Vite env, then process.env (for node contexts)
  const apiKey = apiKeyOverride || import.meta.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please add it in settings.");
  }
  return new GoogleGenAI({ apiKey });
};

const projectSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "A URL-friendly kebab-case name for the project.",
    },
    description: {
      type: Type.STRING,
      description: "A short description of what the app does.",
    },
    files: {
      type: Type.ARRAY,
      description: "The source code files for the application.",
      items: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description: "The file path (e.g., 'src/App.tsx').",
          },
          content: {
            type: Type.STRING,
            description: "The full text content of the file.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  required: ["name", "description", "files"],
};

export const generateProjectCode = async (prompt: string, mode: 'generate' | 'paste' = 'generate', apiKey?: string): Promise<GeneratedProject> => {
  const ai = getAiClient(apiKey);
  let systemInstruction = '';
  const commonRules = `
    CRITICAL VERCEL DEPLOYMENT RULES:
    1.  **vercel.json REQUIRED:** You MUST include a 'vercel.json' file in the root with EXACTLY this content: { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
    2.  **Vite Config:** Ensure 'vite.config.ts' is standard and builds to the 'dist' folder.
    3.  **Entry Point:** 'index.html' must be in the ROOT directory and script src must point to "/src/main.tsx".
    4.  **Package.json:** Ensure 'scripts' has "build": "vite build".
  `;

  if (mode === 'generate') {
    systemInstruction = `
      You are an intelligent Full-Stack AI Developer (Gemini 3 Pro).
      YOUR GOAL: Generate a complete, production-ready React + Vite application.
      TECHNICAL STACK RULES:
      1.  Framework: Vite + React + TypeScript.
      2.  Styling: Tailwind CSS.
      3.  Icons: 'lucide-react'.
      4.  Dependencies: 'package.json' includes: 'react', 'react-dom', 'lucide-react', 'clsx', 'tailwind-merge'. Dev: 'vite', 'typescript', 'tailwindcss', 'postcss', 'autoprefixer'.
      ${commonRules}
      Return ONLY the JSON structure matching the schema.
    `;
  } else {
    systemInstruction = `
      You are an expert Code Architect AI (Gemini 3 Pro). The user is pasting a blob of code.
      YOUR GOAL: Parse the text, identify distinct files, and structure them into a deployable project.
      RULES:
      1.  File Separation: Look for comments like "// File: App.tsx".
      2.  Missing Files: If missing, GENERATE 'index.html', 'package.json', 'vite.config.ts', 'src/main.tsx', 'src/index.css', 'vercel.json'.
      ${commonRules}
      Return ONLY the JSON structure matching the schema.
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", 
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: projectSchema,
        temperature: 0.2, 
      },
    });
    const text = response.text;
    if (!text) throw new Error("No response from AI.");
    return JSON.parse(text) as GeneratedProject;
  } catch (error) {
    console.error(error);
    throw new Error("I failed to process the code. Please check your API key and try again.");
  }
};