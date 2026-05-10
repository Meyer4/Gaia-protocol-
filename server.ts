import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import Database from 'better-sqlite3';
import { GoogleGenAI } from '@google/genai';

import os from "os";

// Initialize SQLite database
const db = new Database('gaia-world.db');

// Create Tables
db.prepare(`
  CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    rating TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS pitches (
    id TEXT PRIMARY KEY,
    target TEXT,
    pitch TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add built-in JSON parsing
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Gaia Network Stats Backend API
  app.get("/api/network/stats", (req, res) => {
     const totalMem = os.totalmem();
     const freeMem = os.freemem();
     const usedMem = totalMem - freeMem;
     const cpuLoad = os.loadavg()[0].toFixed(2); // 1 min load average

     res.json({ 
       activeNodes: Math.floor(Math.random() * 500) + 1200,
       totalCompute: '15.4 PetaFLOPS',
       uptime: '99.99%',
       threatLevel: 'Low',
       lastSync: new Date().toISOString(),
       serverOS: {
         hostname: os.hostname(),
         platform: os.platform(),
         cpuCores: os.cpus().length,
         cpuLoad,
         usedMemoryGB: (usedMem / 1024 / 1024 / 1024).toFixed(2),
         totalMemoryGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
       }
     });
  });

  // SSE stream
  app.get("/api/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const interval = setInterval(() => {
      const types = ['INFO', 'WARN', 'SUCCESS', 'DEBUG'];
      const messages = [
        `Syncing distributed hashes... OK [Node ${Math.random().toString(36).substring(7)}]`,
        `Detected seismic anomaly in Region ${Math.floor(Math.random() * 10)}`,
        `New peer joined the mesh: G-${Math.floor(Math.random() * 10000)}`,
        `ZKP signature verified for block ${Math.floor(Math.random() * 999999)}`,
        `Compute node executing heavy workload (Tensor ops)`,
        `Memory pressure detected on secondary cluster... routing bypass.`
      ];

      sendEvent({
        timestamp: new Date().toISOString(),
        type: types[Math.floor(Math.random() * types.length)],
        message: messages[Math.floor(Math.random() * messages.length)]
      });
    }, 2000);

    req.on("close", () => {
      clearInterval(interval);
    });
  });

  // Pitch History
  app.get("/api/pitches", (req, res) => {
    try {
      const pitches = db.prepare("SELECT * FROM pitches ORDER BY timestamp DESC LIMIT 20").all();
      res.json({ success: true, pitches });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Terminal Ratings Store
  app.post("/api/ratings", (req, res) => {
    const { id, rating } = req.body;
    if (!id || !rating) return res.status(400).json({ error: "Missing id or rating" });
    try {
      db.prepare(`
        INSERT INTO ratings (id, rating) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET rating=excluded.rating
      `).run(id, rating);
      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Secure Backend AI proxy for Gemini
  app.post("/api/ai/pitch", async (req, res) => {
    try {
      const { target, settings } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ text: "Error: GEMINI_API_KEY is not configured on the server." });
      }

      const userName = settings?.userName || "George Meya";
      const jobTitle = settings?.jobTitle || "Founder & Architect";
      const phone1 = settings?.userPhone1 || "+265 991593725";
      const phone2 = settings?.userPhone2 || "+265 883991420";

      const ai = new GoogleGenAI({ apiKey });
      
      let systemInstruction = `You are an expert career advisor and master pitch writer. You are writing on behalf of ${userName}.`;
      let promptText = "";

      if (target.startsWith('intern_') || target.startsWith('job_')) {
          promptText = `Write a compelling job application email / cover letter (3-4 paragraphs) to apply for this role.
I am ${userName}, the creator of the Gaia Protocol—a decentralized node network featuring low-cost distributed compute, real-time sensor grids, and ZKP security built with React and Node.js.
I want them to appreciate this project and my core skills (Distributed Systems, Web3, AI, and Full-Stack Engineering).
Make sure to include a proper greeting like 'Dear Hiring Manager,' or 'Dear Recruiting Team,', and sign off from '${userName}'. Include my phone numbers in the signature: ${phone1} and ${phone2}.

Target Role/Company: `;
      } else {
          promptText = `Write a short, compelling email pitch (3-4 paragraphs) to sell access to our decentralized node network (Gaia Protocol). We offer low-cost distributed compute, real-time sensor grids, and ZKP security.

Make sure to include a proper greeting like 'Dear [Name/Title],' making your best guess at the role or specific person if applicable for the given persona, and sign off from '${userName}, ${jobTitle}, Gaia Protocol'. Include my phone numbers in the signature: ${phone1} and ${phone2}.

Target persona: `;
      }

      switch (target) {
        case 'dept_of_energy':
          promptText += "Department of Energy / Government Scientific Research Body looking for high-capacity climate/seismic simulation compute.";
          break;
        case 'depin_vc':
          promptText += "DePIN (Decentralized Physical Infrastructure Networks) Venture Capitalist looking for the next big crypto/utility network.";
          break;
        case 'ai_enterprise':
          promptText += "Enterprise AI company looking to lower their model training/inference costs by utilizing decentralized idle compute.";
          break;
        case 'weather_org':
          promptText += "Global Weather & Disaster Response Organization seeking real-time unified sensor data (like earthquakes) globally.";
          break;
        case 'intern_web3':
          promptText += "Software Engineering Internship at a top Web3 / Core DePIN company (like Protocol Labs or Solana).";
          break;
        case 'intern_software':
          promptText += "General Software Engineering Internship at a fast-paced innovative tech startup.";
          break;
        case 'job_fullstack':
          promptText += "Full-Stack Distributed Systems Developer role at a top tech enterprise.";
          break;
        case 'job_google':
          promptText += "General Software Engineering or Distributed Systems role at Google.";
          break;
        case 'job_openai':
          promptText += "Software Engineer in AI Infrastructure or Distributed Training at OpenAI.";
          break;
        case 'job_anthropic':
          promptText += "Systems Engineering role at Anthropic, dealing with large-scale compute clusters.";
          break;
        case 'job_cloudflare':
          promptText += "Systems or Edge Computing Engineer at Cloudflare.";
          break;
        case 'job_meta':
          promptText += "Software Engineer, Infrastructure or Reality Labs at Meta.";
          break;
        case 'job_palantir':
          promptText += "Forward Deployed Software Engineer (FDSE) or Distributed Systems Architect at Palantir.";
          break;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptText,
        config: { systemInstruction }
      });

      // Also store the generated pitch in the database
      db.prepare(`
        INSERT INTO pitches (id, target, pitch) VALUES (?, ?, ?)
      `).run(crypto.randomUUID(), target, response.text || '');

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      res.status(500).json({ text: `Failed to generate: ${err.message}` });
    }
  });

  // Secure Backend AI proxy for Assistant Chat
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, language, history } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ text: "Error: GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      let systemInstruction = `You are Gaia, a highly capable AI assistant integrated into the Gaia Protocol dashboard. Your personality is professional, highly intelligent, and helpful—similar to top-tier AI assistants like Claude or Microsoft Copilot. You should always respond in the user's preferred spoken language: ${language || 'English'}. Keep responses concise, clear, and natural to be spoken aloud by a text-to-speech engine.`;

      // Convert history to proper format if needed, but for simplicity we can just pass the latest message and history natively.
      const chatHistory = (history || []).map((h: any) => ({
        role: h.role,
        parts: [{ text: h.text }]
      }));

      chatHistory.push({ role: 'user', parts: [{ text: message }] });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: chatHistory,
        config: { systemInstruction }
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("AI Chat Error:", err);
      res.status(500).json({ text: `Failed to communicate: ${err.message}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Gaia Protocol Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
