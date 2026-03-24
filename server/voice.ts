import { Router } from "express";
import { requireAuth } from "./auth";
import { storage } from "./storage";
import { openai } from "./replit_integrations/audio/client";
import { executeToolCall, getOpenAIToolDefinitions, buildSystemPrompt, autoEnableToolsForAgent } from "./tools";
import multer from "multer";
import OpenAI from "openai";

const voice = Router();
const whisperUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const VALID_REALTIME_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"] as const;

function getRealtimeApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === "_DUMMY_API_KEY_" || key.includes("DUMMY")) return null;
  return key;
}

function sanitizeVoice(voice: string | undefined): string {
  if (voice && (VALID_REALTIME_VOICES as readonly string[]).includes(voice)) return voice;
  return "alloy";
}

voice.post("/api/voice/session", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { agentId } = req.body;
    if (!agentId) return res.status(400).json({ error: "agentId is required" });

    const agent = await storage.getAgentById(agentId, user.organizationId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    let tools = await storage.getToolsByAgent(agent.id);
    if (tools.length === 0) {
      tools = await autoEnableToolsForAgent(agent.id, agent.type);
    }
    const config = (agent.config || {}) as any;

    if (config.rag?.enabled) {
      const hasRagTool = tools.some(t => t.toolName === "knowledge_base_search");
      if (!hasRagTool) {
        tools = [...tools, { id: 0, agentId: agent.id, toolName: "knowledge_base_search", toolCategory: "Knowledge", enabled: true, config: {} } as any];
      }
    }

    const systemPrompt = buildSystemPrompt(agent);
    const toolDefs = getOpenAIToolDefinitions(tools);

    const apiKey = getRealtimeApiKey();
    if (!apiKey) {
      return res.status(503).json({ error: "OpenAI API key not configured. Add OPENAI_API_KEY in Secrets." });
    }

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-realtime-preview-2024-12-17",
        modalities: ["text", "audio"],
        voice: sanitizeVoice(config.voice),
        instructions: systemPrompt,
        tools: toolDefs,
        tool_choice: "auto",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: config.vadSensitivity ?? 0.35,
          silence_duration_ms: 400,
          prefix_padding_ms: 200,
          create_response: true,
        },
        temperature: 0.6,
        speed: config.speed ?? 0.9,
        max_response_output_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Realtime session error:", response.status, errText);
      let detail = "Failed to create realtime session";
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) detail = errJson.error.message;
      } catch {}
      return res.status(502).json({ error: detail });
    }

    const session = await response.json();
    return res.json({
      ...session,
      // Keep legacy token field for backward compatibility
      token: session.client_secret?.value,
      greeting: config.greeting || null,
      agentName: agent.name,
      agentType: agent.type,
    });
  } catch (error: any) {
    console.error("Voice session error:", error);
    return res.status(500).json({ error: "Failed to create voice session: " + error.message });
  }
});

voice.post("/api/voice/tool-call", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { toolName, arguments: args, agentId } = req.body;
    if (!toolName) return res.status(400).json({ error: "toolName is required" });

    const toolArgs = { ...(args || {}) };
    if (agentId) toolArgs._agentId = agentId;

    const result = await executeToolCall(toolName, toolArgs, user.organizationId);
    return res.json(result);
  } catch (error: any) {
    console.error("Tool call error:", error);
    return res.status(500).json({ success: false, result: { error: error.message } });
  }
});

voice.post("/api/voice/chat", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { agentId, messages } = req.body;

    const agent = await storage.getAgentById(agentId, user.organizationId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const tools = await storage.getToolsByAgent(agent.id);
    const systemPrompt = buildSystemPrompt(agent);
    const toolDefs = getOpenAIToolDefinitions(tools);

    const openaiTools = toolDefs.map((t: any) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    let chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages,
    ];

    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatMessages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    });

    let assistantMessage = response.choices[0].message;
    const toolCalls: Array<{ name: string; args: any; result: any }> = [];

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      chatMessages.push(assistantMessage as any);

      for (const tc of assistantMessage.tool_calls) {
        const fn = (tc as any).function;
        const args = JSON.parse(fn.arguments);
        const result = await executeToolCall(fn.name, args, user.organizationId);
        toolCalls.push({ name: fn.name, args, result });

        chatMessages.push({
          role: "tool" as const,
          content: JSON.stringify(result.result),
          tool_call_id: tc.id,
        } as any);
      }

      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: chatMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });
      assistantMessage = response.choices[0].message;
    }

    res.json({
      content: assistantMessage.content,
      toolCalls,
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Chat failed: " + error.message });
  }
});

voice.post("/api/voice/transcribe", requireAuth, whisperUpload.single("audio"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No audio file provided" });

    const apiKey = getRealtimeApiKey();
    if (!apiKey) {
      return res.status(503).json({ error: "OpenAI API key not configured" });
    }

    const directOpenAI = new OpenAI({ apiKey });
    const { toFile } = await import("openai/uploads");
    const ext = file.originalname?.split(".").pop() || "webm";
    const mimeType = file.mimetype || "audio/webm";
    const audioFile = await toFile(file.buffer, `audio.${ext}`, { type: mimeType });

    const transcription = await directOpenAI.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
    });

    return res.json({ text: transcription.text || "" });
  } catch (error: any) {
    console.error("Transcribe error:", error.message);
    return res.status(500).json({ error: "Transcription failed" });
  }
});

export { voice as voiceRouter };
