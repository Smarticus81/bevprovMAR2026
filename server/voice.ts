import { Router } from "express";
import { requireAuth } from "./auth";
import { storage } from "./storage";
import { openai } from "./replit_integrations/audio/client";
import { executeToolCall, getOpenAIToolDefinitions, buildSystemPrompt } from "./tools";

const voice = Router();

function getRealtimeApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === "_DUMMY_API_KEY_" || key.includes("DUMMY")) return null;
  return key;
}

voice.post("/api/voice/session", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { agentId } = req.body;
    if (!agentId) return res.status(400).json({ error: "agentId is required" });

    const agent = await storage.getAgentById(agentId, user.organizationId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const tools = await storage.getToolsByAgent(agent.id);
    const config = (agent.config || {}) as any;
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
        model: "gpt-4o-mini-realtime-preview",
        voice: config.voice || "alloy",
        instructions: systemPrompt,
        tools: toolDefs,
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 600 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Realtime session error:", err);
      return res.status(502).json({ error: "Failed to create realtime session. Check your OpenAI API key and billing." });
    }

    const session = await response.json();
    return res.json({
      token: session.client_secret?.value,
      sessionId: session.id,
      voice: config.voice || "alloy",
      tools: toolDefs.map((t: any) => t.name),
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
    const { toolName, arguments: args } = req.body;
    if (!toolName) return res.status(400).json({ error: "toolName is required" });

    const result = await executeToolCall(toolName, args || {}, user.organizationId);
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
        const args = JSON.parse(tc.function.arguments);
        const result = await executeToolCall(tc.function.name, args, user.organizationId);
        toolCalls.push({ name: tc.function.name, args, result });

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

export { voice as voiceRouter };
