import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWaitlistSchema, AGENT_TYPES } from "@shared/schema";
import { requireAuth } from "./auth";
import { voiceRouter } from "./voice";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use(voiceRouter);

  app.post("/api/waitlist", async (req, res) => {
    const parsed = insertWaitlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const entry = await storage.addToWaitlist(parsed.data);
    return res.status(201).json(entry);
  });

  app.get("/api/agents", requireAuth, async (req, res) => {
    const user = req.user as any;
    const agentsList = await storage.getAgentsByOrg(user.organizationId);
    return res.json(agentsList);
  });

  app.post("/api/agents", requireAuth, async (req, res) => {
    const user = req.user as any;
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(AGENT_TYPES),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const agent = await storage.createAgent({
      ...parsed.data,
      organizationId: user.organizationId,
      status: "draft",
      config: {
        voice: "alloy",
        language: "en",
        speed: 1,
        greeting: "Hello! How can I help you today?",
      },
    });
    return res.status(201).json(agent);
  });

  app.get("/api/agents/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const agent = await storage.getAgentById(parseInt(req.params.id), user.organizationId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    return res.json(agent);
  });

  app.patch("/api/agents/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const allowedFields = ["name", "description", "status", "config"];
    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const agent = await storage.updateAgent(
      parseInt(req.params.id),
      user.organizationId,
      updates
    );
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    return res.json(agent);
  });

  app.delete("/api/agents/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const deleted = await storage.deleteAgent(parseInt(req.params.id), user.organizationId);
    if (!deleted) return res.status(404).json({ error: "Agent not found" });
    return res.status(204).send();
  });

  app.get("/api/agents/:id/tools", requireAuth, async (req, res) => {
    const user = req.user as any;
    const agent = await storage.getAgentById(parseInt(req.params.id), user.organizationId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const tools = await storage.getToolsByAgent(agent.id);
    return res.json(tools);
  });

  app.put("/api/agents/:id/tools", requireAuth, async (req, res) => {
    const user = req.user as any;
    const agent = await storage.getAgentById(parseInt(req.params.id), user.organizationId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const tools = await storage.setAgentTools(agent.id, req.body.tools || []);
    return res.json(tools);
  });

  return httpServer;
}
