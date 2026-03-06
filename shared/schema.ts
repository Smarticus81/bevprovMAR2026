import { sql } from "drizzle-orm";
import { pgTable, text, serial, timestamp, integer, jsonb, boolean, numeric, date } from "drizzle-orm/pg-core";
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

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  description: text("description"),
  available: boolean("available").notNull().default(true),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  reorderThreshold: numeric("reorder_threshold", { precision: 10, scale: 2 }).notNull().default("0"),
  supplier: text("supplier"),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  items: jsonb("items").$type<OrderItem[]>().notNull().default([]),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  tableNumber: integer("table_number"),
  customerName: text("customer_name"),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tabs = pgTable("tabs", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  items: jsonb("items").$type<OrderItem[]>().notNull().default([]),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("open"),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  eventDate: date("event_date").notNull(),
  eventTime: text("event_time"),
  eventType: text("event_type").notNull(),
  guestName: text("guest_name").notNull(),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  guestCount: integer("guest_count").notNull().default(1),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const staffMembers = pgTable("staff_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  email: text("email"),
  phone: text("phone"),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
});

export const staffShifts = pgTable("staff_shifts", {
  id: serial("id").primaryKey(),
  staffMemberId: integer("staff_member_id").references(() => staffMembers.id, { onDelete: "cascade" }).notNull(),
  shiftDate: date("shift_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
});

export const guests = pgTable("guests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  visitCount: integer("visit_count").notNull().default(0),
  totalSpent: numeric("total_spent", { precision: 10, scale: 2 }).notNull().default("0"),
  vipStatus: boolean("vip_status").notNull().default(false),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  assignee: text("assignee"),
  dueDate: date("due_date"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const wasteLogs = pgTable("waste_logs", {
  id: serial("id").primaryKey(),
  item: text("item").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit"),
  reason: text("reason").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ragDocuments = pgTable("rag_documents", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: "cascade" }).notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  filename: text("filename").notNull(),
  content: text("content").notNull(),
  contentType: text("content_type").notNull().default("text/plain"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  items: text("items"),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
});

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface WakeWordConfig {
  enabled: boolean;
  phrase: string;
  endPhrases: string[];
  shutdownPhrases: string[];
  levenshteinThreshold: number;
}

export interface ExternalDbConfig {
  enabled: boolean;
  type: "supabase" | "convex" | "custom";
  connectionString: string;
}

export interface RagConfig {
  enabled: boolean;
  maxResults: number;
}

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
  wakeWord?: WakeWordConfig;
  externalDb?: ExternalDbConfig;
  rag?: RagConfig;
  mcpEnabled?: boolean;
  fileUploadEnabled?: boolean;
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
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true });
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertTabSchema = createInsertSchema(tabs).omit({ id: true, createdAt: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });
export const insertStaffMemberSchema = createInsertSchema(staffMembers).omit({ id: true });
export const insertStaffShiftSchema = createInsertSchema(staffShifts).omit({ id: true });
export const insertGuestSchema = createInsertSchema(guests).omit({ id: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export const insertWasteLogSchema = createInsertSchema(wasteLogs).omit({ id: true, createdAt: true });
export const insertRagDocumentSchema = createInsertSchema(ragDocuments).omit({ id: true, createdAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });

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
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertTab = z.infer<typeof insertTabSchema>;
export type Tab = typeof tabs.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertStaffMember = z.infer<typeof insertStaffMemberSchema>;
export type StaffMember = typeof staffMembers.$inferSelect;
export type InsertStaffShift = z.infer<typeof insertStaffShiftSchema>;
export type StaffShift = typeof staffShifts.$inferSelect;
export type InsertGuest = z.infer<typeof insertGuestSchema>;
export type Guest = typeof guests.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertWasteLog = z.infer<typeof insertWasteLogSchema>;
export type WasteLog = typeof wasteLogs.$inferSelect;
export type InsertRagDocument = z.infer<typeof insertRagDocumentSchema>;
export type RagDocument = typeof ragDocuments.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;
