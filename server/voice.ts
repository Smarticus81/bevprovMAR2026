import { Router } from "express";
import { requireAuth } from "./auth";
import { storage } from "./storage";
import { openai } from "./replit_integrations/audio/client";
import { executeToolCall, getOpenAIToolDefinitions, buildSystemPrompt } from "./tools";

const voice = Router();

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

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY}`,
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
      return res.status(502).json({ error: "Failed to create realtime session", fallback: true });
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
    return res.status(500).json({ error: "Failed to create voice session", fallback: true });
  }
});

voice.post("/api/voice/tool-call", requireAuth, async (req, res) => {
  try {
    const { toolName, arguments: args } = req.body;
    if (!toolName) return res.status(400).json({ error: "toolName is required" });

    const result = executeToolCall(toolName, args || {});
    return res.json(result);
  } catch (error: any) {
    console.error("Tool call error:", error);
    return res.status(500).json({ success: false, result: { error: error.message } });
  }
});

voice.post("/api/voice/transcribe", requireAuth, async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      const audioBuffer = Buffer.concat(chunks);
      const file = new File([audioBuffer], "audio.webm", { type: "audio/webm" });
      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file,
      });
      res.json({ text: transcription.text });
    });
  } catch (error: any) {
    console.error("Transcription error:", error);
    res.status(500).json({ error: "Transcription failed" });
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
        const result = executeToolCall(tc.function.name, args);
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
    res.status(500).json({ error: "Chat failed" });
  }
});

voice.post("/api/voice/synthesize", requireAuth, async (req, res) => {
  try {
    const { text, voice: voiceName } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: (voiceName || "alloy") as any,
      input: text,
      response_format: "mp3",
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set({ "Content-Type": "audio/mpeg", "Content-Length": buffer.length.toString() });
    res.send(buffer);
  } catch (error: any) {
    console.error("Synthesis error:", error);
    res.status(500).json({ error: "Speech synthesis failed" });
  }
});

export { voice as voiceRouter };
