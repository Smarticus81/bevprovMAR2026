import { sql } from "drizzle-orm";
import { pgTable, text, serial, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("starter"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("owner"),
  organizationId: integer("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  status: text("status").notNull().default("draft"),
  config: jsonb("config").$type<AgentConfig>().default({}),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentTools = pgTable("agent_tools", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: "cascade" }).notNull(),
  toolName: text("tool_name").notNull(),
  toolCategory: text("tool_category").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
});

export const waitlist = pgTable("waitlist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  agentType: text("agent_type").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export interface AgentConfig {
  voice?: string;
  language?: string;
  speed?: number;
  greeting?: string;
  vadSensitivity?: number;
  maxConversationLength?: number;
  operatingHours?: { start: string; end: string };
  fallbackMessage?: string;
  squareEnabled?: boolean;
  toastEnabled?: boolean;
  systemPrompt?: string;
}

export const AGENT_TYPES = [
  "pos-integration",
  "voice-pos",
  "inventory",
  "venue-admin",
  "bevone",
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  "pos-integration": "POS Integration Agent",
  "voice-pos": "Agentic Voice POS",
  "inventory": "Inventory Manager",
  "venue-admin": "Venue Agent",
  "bevone": "BevOne",
};

export const AGENT_TYPE_DESCRIPTIONS: Record<AgentType, string> = {
  "pos-integration": "Seamless voice layer for Square & Toast POS systems.",
  "voice-pos": "Fully voice-controlled point of sale system.",
  "inventory": "Track stock levels and sync with POS automatically.",
  "venue-admin": "Handle bookings, staff scheduling, and venue operations.",
  "bevone": "The all-in-one comprehensive venue assistant.",
};

export const insertOrgSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertAgentSchema = createInsertSchema(agents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAgentToolSchema = createInsertSchema(agentTools).omit({ id: true });
export const insertWaitlistSchema = createInsertSchema(waitlist).omit({ id: true, createdAt: true });

export type InsertOrg = z.infer<typeof insertOrgSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;
export type InsertAgentTool = z.infer<typeof insertAgentToolSchema>;
export type AgentTool = typeof agentTools.$inferSelect;
export type InsertWaitlistEntry = z.infer<typeof insertWaitlistSchema>;
export type WaitlistEntry = typeof waitlist.$inferSelect;
