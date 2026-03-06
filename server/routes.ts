import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWaitlistSchema, AGENT_TYPES } from "@shared/schema";
import { requireAuth } from "./auth";
import { voiceRouter } from "./voice";
import { mcpRouter } from "./mcp";
import { autoEnableToolsForAgent } from "./tools";
import { z } from "zod";
import multer from "multer";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { sql } from "drizzle-orm";

const PLAN_LIMITS: Record<string, { agents: number; venues: number }> = {
  starter: { agents: 2, venues: 1 },
  pro: { agents: Infinity, venues: 3 },
  enterprise: { agents: Infinity, venues: Infinity },
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use(voiceRouter);
  app.use(mcpRouter);

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

    const org = await storage.getOrganization(user.organizationId);
    const plan = org?.plan || "starter";
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    const agentCount = await storage.getAgentCountByOrg(user.organizationId);
    if (agentCount >= limits.agents) {
      return res.status(403).json({
        error: `Your ${plan} plan allows up to ${limits.agents} agents. Upgrade to create more.`,
        code: "PLAN_LIMIT_REACHED",
        currentCount: agentCount,
        limit: limits.agents,
        plan,
      });
    }

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

    await autoEnableToolsForAgent(agent.id, parsed.data.type);

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

  // ========== MENU ITEMS ==========
  app.get("/api/venue/menu", requireAuth, async (req, res) => {
    const user = req.user as any;
    const items = await storage.getMenuItems(user.organizationId);
    return res.json(items);
  });

  app.post("/api/venue/menu", requireAuth, async (req, res) => {
    const user = req.user as any;
    const schema = z.object({
      name: z.string().min(1),
      price: z.string(),
      category: z.string().min(1),
      description: z.string().optional(),
      available: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const item = await storage.createMenuItem({ ...parsed.data, organizationId: user.organizationId });
    return res.status(201).json(item);
  });

  app.post("/api/venue/menu/bulk", requireAuth, async (req, res) => {
    const user = req.user as any;
    const itemSchema = z.object({
      name: z.string().min(1),
      price: z.union([z.string(), z.number()]).transform(v => String(v)),
      category: z.string().optional().default("food"),
      description: z.string().optional().default(""),
      available: z.boolean().optional().default(true),
    });
    const schema = z.object({ items: z.array(itemSchema).min(1).max(500) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const created = [];
      const errors: { index: number; name: string; error: string }[] = [];
      for (let i = 0; i < parsed.data.items.length; i++) {
        try {
          const result = await storage.createMenuItem({ ...parsed.data.items[i], organizationId: user.organizationId });
          created.push(result);
        } catch (e: any) {
          errors.push({ index: i, name: parsed.data.items[i].name, error: e.message || "Failed to create" });
        }
      }
      return res.status(201).json({ imported: created.length, failed: errors.length, items: created, errors: errors.length > 0 ? errors : undefined });
    } catch (e: any) {
      return res.status(500).json({ error: "Bulk import failed: " + (e.message || "Unknown error") });
    }
  });

  app.patch("/api/venue/menu/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const item = await storage.updateMenuItem(parseInt(req.params.id), user.organizationId, req.body);
    if (!item) return res.status(404).json({ error: "Item not found" });
    return res.json(item);
  });

  app.delete("/api/venue/menu/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const deleted = await storage.deleteMenuItem(parseInt(req.params.id), user.organizationId);
    if (!deleted) return res.status(404).json({ error: "Item not found" });
    return res.status(204).send();
  });

  // ========== INVENTORY ==========
  app.get("/api/venue/inventory", requireAuth, async (req, res) => {
    const user = req.user as any;
    const items = await storage.getInventoryItems(user.organizationId);
    return res.json(items);
  });

  app.post("/api/venue/inventory", requireAuth, async (req, res) => {
    const user = req.user as any;
    const schema = z.object({
      name: z.string().min(1),
      quantity: z.string(),
      unit: z.string().min(1),
      cost: z.string().optional(),
      reorderThreshold: z.string().optional(),
      supplier: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const item = await storage.createInventoryItem({ ...parsed.data, organizationId: user.organizationId });
    return res.status(201).json(item);
  });

  app.patch("/api/venue/inventory/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const item = await storage.updateInventoryItem(parseInt(req.params.id), user.organizationId, req.body);
    if (!item) return res.status(404).json({ error: "Item not found" });
    return res.json(item);
  });

  app.delete("/api/venue/inventory/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const deleted = await storage.deleteInventoryItem(parseInt(req.params.id), user.organizationId);
    if (!deleted) return res.status(404).json({ error: "Item not found" });
    return res.status(204).send();
  });

  // ========== STAFF ==========
  app.get("/api/venue/staff", requireAuth, async (req, res) => {
    const user = req.user as any;
    const staff = await storage.getStaffMembers(user.organizationId);
    return res.json(staff);
  });

  app.post("/api/venue/staff", requireAuth, async (req, res) => {
    const user = req.user as any;
    const schema = z.object({
      name: z.string().min(1),
      role: z.string().min(1),
      email: z.string().optional(),
      phone: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const member = await storage.createStaffMember({ ...parsed.data, organizationId: user.organizationId });
    return res.status(201).json(member);
  });

  app.patch("/api/venue/staff/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const member = await storage.updateStaffMember(parseInt(req.params.id), user.organizationId, req.body);
    if (!member) return res.status(404).json({ error: "Staff member not found" });
    return res.json(member);
  });

  app.delete("/api/venue/staff/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const deleted = await storage.deleteStaffMember(parseInt(req.params.id), user.organizationId);
    if (!deleted) return res.status(404).json({ error: "Staff member not found" });
    return res.status(204).send();
  });

  // ========== BOOKINGS ==========
  app.get("/api/venue/bookings", requireAuth, async (req, res) => {
    const user = req.user as any;
    const bookingsList = await storage.getBookings(user.organizationId);
    return res.json(bookingsList);
  });

  app.post("/api/venue/bookings", requireAuth, async (req, res) => {
    const user = req.user as any;
    const schema = z.object({
      eventDate: z.string(),
      eventTime: z.string().optional(),
      eventType: z.string().min(1),
      guestName: z.string().min(1),
      guestEmail: z.string().optional(),
      guestPhone: z.string().optional(),
      guestCount: z.number().optional(),
      notes: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const booking = await storage.createBooking({ ...parsed.data, organizationId: user.organizationId });
    return res.status(201).json(booking);
  });

  app.patch("/api/venue/bookings/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const booking = await storage.updateBooking(parseInt(req.params.id), user.organizationId, req.body);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    return res.json(booking);
  });

  app.delete("/api/venue/bookings/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const deleted = await storage.deleteBooking(parseInt(req.params.id), user.organizationId);
    if (!deleted) return res.status(404).json({ error: "Booking not found" });
    return res.status(204).send();
  });

  // ========== GUESTS ==========
  app.get("/api/venue/guests", requireAuth, async (req, res) => {
    const user = req.user as any;
    const guestList = await storage.getGuests(user.organizationId);
    return res.json(guestList);
  });

  app.post("/api/venue/guests", requireAuth, async (req, res) => {
    const user = req.user as any;
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      vipStatus: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const guest = await storage.createGuest({ ...parsed.data, organizationId: user.organizationId });
    return res.status(201).json(guest);
  });

  app.patch("/api/venue/guests/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const guest = await storage.updateGuest(parseInt(req.params.id), user.organizationId, req.body);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    return res.json(guest);
  });

  app.delete("/api/venue/guests/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const deleted = await storage.deleteGuest(parseInt(req.params.id), user.organizationId);
    if (!deleted) return res.status(404).json({ error: "Guest not found" });
    return res.status(204).send();
  });

  // ========== SUPPLIERS ==========
  app.get("/api/venue/suppliers", requireAuth, async (req, res) => {
    const user = req.user as any;
    const supplierList = await storage.getSuppliers(user.organizationId);
    return res.json(supplierList);
  });

  app.post("/api/venue/suppliers", requireAuth, async (req, res) => {
    const user = req.user as any;
    const schema = z.object({
      name: z.string().min(1),
      contactName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      items: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const supplier = await storage.createSupplier({ ...parsed.data, organizationId: user.organizationId });
    return res.status(201).json(supplier);
  });

  app.patch("/api/venue/suppliers/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const supplier = await storage.updateSupplier(parseInt(req.params.id), user.organizationId, req.body);
    if (!supplier) return res.status(404).json({ error: "Supplier not found" });
    return res.json(supplier);
  });

  app.delete("/api/venue/suppliers/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const deleted = await storage.deleteSupplier(parseInt(req.params.id), user.organizationId);
    if (!deleted) return res.status(404).json({ error: "Supplier not found" });
    return res.status(204).send();
  });

  // ========== TASKS ==========
  app.get("/api/venue/tasks", requireAuth, async (req, res) => {
    const user = req.user as any;
    const taskList = await storage.getTasks(user.organizationId);
    return res.json(taskList);
  });

  app.post("/api/venue/tasks", requireAuth, async (req, res) => {
    const user = req.user as any;
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      assignee: z.string().optional(),
      dueDate: z.string().optional(),
      priority: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const task = await storage.createTask({ ...parsed.data, organizationId: user.organizationId });
    return res.status(201).json(task);
  });

  app.patch("/api/venue/tasks/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const task = await storage.updateTask(parseInt(req.params.id), user.organizationId, req.body);
    if (!task) return res.status(404).json({ error: "Task not found" });
    return res.json(task);
  });

  app.delete("/api/venue/tasks/:id", requireAuth, async (req, res) => {
    const user = req.user as any;
    const deleted = await storage.deleteTask(parseInt(req.params.id), user.organizationId);
    if (!deleted) return res.status(404).json({ error: "Task not found" });
    return res.status(204).send();
  });

  // ========== ORDERS (read-only for dashboard) ==========
  app.get("/api/venue/orders", requireAuth, async (req, res) => {
    const user = req.user as any;
    const ordersList = await storage.getOrders(user.organizationId);
    return res.json(ordersList);
  });

  // ========== REVENUE STATS ==========
  app.get("/api/venue/stats", requireAuth, async (req, res) => {
    const user = req.user as any;
    const stats = await storage.getRevenueStats(user.organizationId);
    return res.json(stats);
  });

  // ========== RAG DOCUMENTS ==========
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

  app.get("/api/agents/:id/documents", requireAuth, async (req, res) => {
    const user = req.user as any;
    const agentId = parseInt(req.params.id);
    const agent = await storage.getAgentById(agentId, user.organizationId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const docs = await storage.getRagDocuments(agentId, user.organizationId);
    return res.json(docs);
  });

  app.post("/api/agents/:id/documents", requireAuth, upload.single("file"), async (req, res) => {
    const user = req.user as any;
    const agentId = parseInt(req.params.id);
    const agent = await storage.getAgentById(agentId, user.organizationId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const allowedTypes = ["text/plain", "text/csv", "text/markdown", "application/json", "text/html"];
    const isText = allowedTypes.includes(file.mimetype) || file.originalname.endsWith(".txt") || file.originalname.endsWith(".md") || file.originalname.endsWith(".csv") || file.originalname.endsWith(".json");
    if (!isText) return res.status(400).json({ error: "Only text-based files are supported (.txt, .md, .csv, .json)" });

    const content = file.buffer.toString("utf-8");
    const doc = await storage.createRagDocument({
      agentId,
      organizationId: user.organizationId,
      filename: file.originalname,
      content,
      contentType: file.mimetype || "text/plain",
      sizeBytes: file.size,
    });
    return res.status(201).json(doc);
  });

  app.delete("/api/agents/:id/documents/:docId", requireAuth, async (req, res) => {
    const user = req.user as any;
    const agentId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    const agent = await storage.getAgentById(agentId, user.organizationId);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const deleted = await storage.deleteRagDocument(docId, user.organizationId);
    if (!deleted) return res.status(404).json({ error: "Document not found" });
    return res.json({ success: true });
  });

  app.get("/api/agents/:id/documents/search", requireAuth, async (req, res) => {
    const user = req.user as any;
    const agentId = parseInt(req.params.id);
    const query = (req.query.q as string) || "";
    if (!query) return res.status(400).json({ error: "Query parameter 'q' is required" });
    const results = await storage.searchRagDocuments(agentId, user.organizationId, query);
    return res.json(results);
  });

  // ========== BILLING / STRIPE ==========

  app.get("/api/billing/config", async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (err: any) {
      res.json({ publishableKey: null, error: err.message });
    }
  });

  app.get("/api/billing/products", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
        ORDER BY pr.unit_amount ASC
      `);
      const productsMap = new Map<string, any>();
      for (const row of result.rows) {
        const r = row as any;
        if (!productsMap.has(r.product_id)) {
          productsMap.set(r.product_id, {
            id: r.product_id,
            name: r.product_name,
            description: r.product_description,
            metadata: r.product_metadata,
            prices: [],
          });
        }
        if (r.price_id) {
          productsMap.get(r.product_id).prices.push({
            id: r.price_id,
            unitAmount: r.unit_amount,
            currency: r.currency,
            recurring: r.recurring,
          });
        }
      }
      return res.json(Array.from(productsMap.values()));
    } catch (err: any) {
      console.error("Error listing products:", err.message);
      return res.json([]);
    }
  });

  app.get("/api/billing/subscription", requireAuth, async (req, res) => {
    const user = req.user as any;
    const org = await storage.getOrganization(user.organizationId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    if (!org.stripeSubscriptionId) {
      return res.json({ subscription: null, plan: org.plan });
    }

    try {
      const result = await db.execute(
        sql`SELECT * FROM stripe.subscriptions WHERE id = ${org.stripeSubscriptionId}`
      );
      const subscription = result.rows[0] || null;
      return res.json({ subscription, plan: org.plan });
    } catch (err: any) {
      return res.json({ subscription: null, plan: org.plan, error: err.message });
    }
  });

  app.get("/api/billing/limits", requireAuth, async (req, res) => {
    const user = req.user as any;
    const org = await storage.getOrganization(user.organizationId);
    const plan = org?.plan || "starter";
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    const agentCount = await storage.getAgentCountByOrg(user.organizationId);
    return res.json({
      plan,
      limits: {
        agents: limits.agents === Infinity ? "unlimited" : limits.agents,
        venues: limits.venues === Infinity ? "unlimited" : limits.venues,
      },
      usage: {
        agents: agentCount,
      },
    });
  });

  app.post("/api/billing/checkout", requireAuth, async (req, res) => {
    const user = req.user as any;
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId is required" });

    try {
      const stripe = await getUncachableStripeClient();
      const org = await storage.getOrganization(user.organizationId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      let customerId = org.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { organizationId: String(org.id), orgName: org.name },
        });
        customerId = customer.id;
        await storage.updateOrganization(org.id, { stripeCustomerId: customerId });
      }

      const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
      const baseUrl = domain ? `https://${domain}` : "http://localhost:5000";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${baseUrl}/dashboard/billing?success=true`,
        cancel_url: `${baseUrl}/dashboard/billing?canceled=true`,
        metadata: { organizationId: String(org.id) },
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Checkout error:", err.message);
      return res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  app.post("/api/billing/portal", requireAuth, async (req, res) => {
    const user = req.user as any;
    const org = await storage.getOrganization(user.organizationId);
    if (!org?.stripeCustomerId) {
      return res.status(400).json({ error: "No billing account found. Subscribe to a plan first." });
    }

    try {
      const stripe = await getUncachableStripeClient();
      const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
      const baseUrl = domain ? `https://${domain}` : "http://localhost:5000";

      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${baseUrl}/dashboard/billing`,
      });

      return res.json({ url: session.url });
    } catch (err: any) {
      console.error("Portal error:", err.message);
      return res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  app.post("/api/billing/sync-subscription", requireAuth, async (req, res) => {
    const user = req.user as any;
    const org = await storage.getOrganization(user.organizationId);
    if (!org?.stripeCustomerId) {
      return res.json({ synced: false });
    }

    try {
      const stripe = await getUncachableStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: org.stripeCustomerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        const priceId = sub.items.data[0]?.price?.id;
        let newPlan = "starter";

        if (priceId) {
          const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
          const product = price.product as any;
          if (product?.metadata?.bevpro_plan) {
            newPlan = product.metadata.bevpro_plan;
          }
        }

        await storage.updateOrganization(org.id, {
          plan: newPlan,
          stripeSubscriptionId: sub.id,
        });
        return res.json({ synced: true, plan: newPlan, subscriptionId: sub.id });
      } else {
        await storage.updateOrganization(org.id, {
          plan: "starter",
          stripeSubscriptionId: null as any,
        });
        return res.json({ synced: true, plan: "starter" });
      }
    } catch (err: any) {
      console.error("Sync subscription error:", err.message);
      return res.status(500).json({ error: "Failed to sync subscription" });
    }
  });

  return httpServer;
}
