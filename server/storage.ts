import {
  type Organization, type InsertOrg, organizations,
  type User, type InsertUser, users,
  type Agent, type InsertAgent, agents,
  type AgentTool, type InsertAgentTool, agentTools,
  type WaitlistEntry, type InsertWaitlistEntry, waitlist,
  type MenuItem, type InsertMenuItem, menuItems,
  type InventoryItem, type InsertInventoryItem, inventoryItems,
  type Order, type InsertOrder, orders, type OrderItem,
  type Tab, type InsertTab, tabs,
  type Booking, type InsertBooking, bookings,
  type StaffMember, type InsertStaffMember, staffMembers,
  type StaffShift, type InsertStaffShift, staffShifts,
  type Guest, type InsertGuest, guests,
  type Task, type InsertTask, tasks,
  type WasteLog, type InsertWasteLog, wasteLogs,
  type Supplier, type InsertSupplier, suppliers,
  type RagDocument, type InsertRagDocument, ragDocuments,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, lte, sql, gte, desc } from "drizzle-orm";

export interface IStorage {
  createOrganization(org: InsertOrg): Promise<Organization>;
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;

  createUser(user: InsertUser): Promise<User>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;

  getAgentsByOrg(orgId: number): Promise<Agent[]>;
  getAgentById(id: number, orgId: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, orgId: number, data: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: number, orgId: number): Promise<boolean>;

  getToolsByAgent(agentId: number): Promise<AgentTool[]>;
  setAgentTools(agentId: number, tools: InsertAgentTool[]): Promise<AgentTool[]>;

  addToWaitlist(entry: InsertWaitlistEntry): Promise<WaitlistEntry>;

  getMenuItems(orgId: number, query?: string, category?: string): Promise<MenuItem[]>;
  getMenuItem(id: number, orgId: number): Promise<MenuItem | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: number, orgId: number, data: Partial<InsertMenuItem>): Promise<MenuItem | undefined>;
  deleteMenuItem(id: number, orgId: number): Promise<boolean>;

  getInventoryItems(orgId: number, query?: string): Promise<InventoryItem[]>;
  getInventoryItem(id: number, orgId: number): Promise<InventoryItem | undefined>;
  getInventoryItemByName(name: string, orgId: number): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: number, orgId: number, data: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: number, orgId: number): Promise<boolean>;
  getLowStockItems(orgId: number): Promise<InventoryItem[]>;

  getOrders(orgId: number, status?: string): Promise<Order[]>;
  getOrder(id: number, orgId: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, orgId: number, data: Partial<InsertOrder>): Promise<Order | undefined>;

  getTabs(orgId: number, status?: string): Promise<Tab[]>;
  getTab(id: number, orgId: number): Promise<Tab | undefined>;
  getTabByCustomer(customerName: string, orgId: number): Promise<Tab | undefined>;
  createTab(tab: InsertTab): Promise<Tab>;
  updateTab(id: number, orgId: number, data: Partial<InsertTab>): Promise<Tab | undefined>;

  getBookings(orgId: number, status?: string): Promise<Booking[]>;
  getBooking(id: number, orgId: number): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, orgId: number, data: Partial<InsertBooking>): Promise<Booking | undefined>;
  deleteBooking(id: number, orgId: number): Promise<boolean>;
  getAvailableDates(orgId: number): Promise<string[]>;

  getStaffMembers(orgId: number): Promise<StaffMember[]>;
  getStaffMember(id: number, orgId: number): Promise<StaffMember | undefined>;
  createStaffMember(member: InsertStaffMember): Promise<StaffMember>;
  updateStaffMember(id: number, orgId: number, data: Partial<InsertStaffMember>): Promise<StaffMember | undefined>;
  deleteStaffMember(id: number, orgId: number): Promise<boolean>;

  getStaffShifts(orgId: number, date?: string): Promise<(StaffShift & { staffName?: string; staffRole?: string })[]>;
  createStaffShift(shift: InsertStaffShift): Promise<StaffShift>;
  deleteStaffShift(id: number, orgId: number): Promise<boolean>;

  getGuests(orgId: number, query?: string): Promise<Guest[]>;
  getGuest(id: number, orgId: number): Promise<Guest | undefined>;
  getGuestByName(name: string, orgId: number): Promise<Guest | undefined>;
  createGuest(guest: InsertGuest): Promise<Guest>;
  updateGuest(id: number, orgId: number, data: Partial<InsertGuest>): Promise<Guest | undefined>;
  deleteGuest(id: number, orgId: number): Promise<boolean>;

  getTasks(orgId: number, status?: string): Promise<Task[]>;
  getTask(id: number, orgId: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, orgId: number, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number, orgId: number): Promise<boolean>;

  createWasteLog(log: InsertWasteLog): Promise<WasteLog>;
  getWasteLogs(orgId: number): Promise<WasteLog[]>;

  getSuppliers(orgId: number): Promise<Supplier[]>;
  getSupplier(id: number, orgId: number): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, orgId: number, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: number, orgId: number): Promise<boolean>;

  updateOrganization(id: number, data: Partial<{ plan: string; stripeCustomerId: string; stripeSubscriptionId: string }>): Promise<Organization | undefined>;
  getOrganizationByStripeCustomerId(customerId: string): Promise<Organization | undefined>;
  getAgentCountByOrg(orgId: number): Promise<number>;

  getRevenueStats(orgId: number, startDate?: string, endDate?: string): Promise<{ revenue: number; orderCount: number; avgOrder: number }>;

  getRagDocuments(agentId: number, orgId: number): Promise<RagDocument[]>;
  createRagDocument(doc: InsertRagDocument): Promise<RagDocument>;
  deleteRagDocument(id: number, orgId: number): Promise<boolean>;
  searchRagDocuments(agentId: number, orgId: number, query: string, maxResults?: number): Promise<RagDocument[]>;
  getDocumentById(id: number, orgId: number): Promise<RagDocument | undefined>;
  listAllRagDocuments(orgId: number, agentId?: number): Promise<RagDocument[]>;
}

export class DatabaseStorage implements IStorage {
  async createOrganization(org: InsertOrg): Promise<Organization> {
    const [result] = await db.insert(organizations).values(org).returning();
    return result;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [result] = await db.select().from(organizations).where(eq(organizations.id, id));
    return result;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [result] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    return result;
  }

  async updateOrganization(id: number, data: Partial<{ plan: string; stripeCustomerId: string; stripeSubscriptionId: string }>): Promise<Organization | undefined> {
    const [result] = await db.update(organizations).set(data).where(eq(organizations.id, id)).returning();
    return result;
  }

  async getOrganizationByStripeCustomerId(customerId: string): Promise<Organization | undefined> {
    const [result] = await db.select().from(organizations).where(eq(organizations.stripeCustomerId, customerId));
    return result;
  }

  async getAgentCountByOrg(orgId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(agents).where(eq(agents.organizationId, orgId));
    return result[0]?.count ?? 0;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [result] = await db.insert(users).values(user).returning();
    return result;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.id, id));
    return result;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.email, email));
    return result;
  }

  async getAgentsByOrg(orgId: number): Promise<Agent[]> {
    return await db.select().from(agents).where(eq(agents.organizationId, orgId));
  }

  async getAgentById(id: number, orgId: number): Promise<Agent | undefined> {
    const [result] = await db.select().from(agents).where(
      and(eq(agents.id, id), eq(agents.organizationId, orgId))
    );
    return result;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [result] = await db.insert(agents).values(agent).returning();
    return result;
  }

  async updateAgent(id: number, orgId: number, data: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [result] = await db
      .update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(agents.id, id), eq(agents.organizationId, orgId)))
      .returning();
    return result;
  }

  async deleteAgent(id: number, orgId: number): Promise<boolean> {
    const result = await db
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.organizationId, orgId)))
      .returning();
    return result.length > 0;
  }

  async getToolsByAgent(agentId: number): Promise<AgentTool[]> {
    return await db.select().from(agentTools).where(eq(agentTools.agentId, agentId));
  }

  async setAgentTools(agentId: number, tools: InsertAgentTool[]): Promise<AgentTool[]> {
    await db.delete(agentTools).where(eq(agentTools.agentId, agentId));
    if (tools.length === 0) return [];
    return await db.insert(agentTools).values(tools).returning();
  }

  async addToWaitlist(entry: InsertWaitlistEntry): Promise<WaitlistEntry> {
    const [result] = await db.insert(waitlist).values(entry).returning();
    return result;
  }

  async getMenuItems(orgId: number, query?: string, category?: string): Promise<MenuItem[]> {
    let q = db.select().from(menuItems).where(eq(menuItems.organizationId, orgId));
    const conditions = [eq(menuItems.organizationId, orgId)];
    if (category) conditions.push(eq(menuItems.category, category));
    if (query) conditions.push(ilike(menuItems.name, `%${query}%`));
    return await db.select().from(menuItems).where(and(...conditions));
  }

  async getMenuItem(id: number, orgId: number): Promise<MenuItem | undefined> {
    const [result] = await db.select().from(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.organizationId, orgId)));
    return result;
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const [result] = await db.insert(menuItems).values(item).returning();
    return result;
  }

  async updateMenuItem(id: number, orgId: number, data: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    const [result] = await db.update(menuItems).set(data).where(and(eq(menuItems.id, id), eq(menuItems.organizationId, orgId))).returning();
    return result;
  }

  async deleteMenuItem(id: number, orgId: number): Promise<boolean> {
    const result = await db.delete(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.organizationId, orgId))).returning();
    return result.length > 0;
  }

  async getInventoryItems(orgId: number, query?: string): Promise<InventoryItem[]> {
    const conditions = [eq(inventoryItems.organizationId, orgId)];
    if (query) conditions.push(ilike(inventoryItems.name, `%${query}%`));
    return await db.select().from(inventoryItems).where(and(...conditions));
  }

  async getInventoryItem(id: number, orgId: number): Promise<InventoryItem | undefined> {
    const [result] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.organizationId, orgId)));
    return result;
  }

  async getInventoryItemByName(name: string, orgId: number): Promise<InventoryItem | undefined> {
    const [result] = await db.select().from(inventoryItems).where(and(ilike(inventoryItems.name, name), eq(inventoryItems.organizationId, orgId)));
    return result;
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const [result] = await db.insert(inventoryItems).values(item).returning();
    return result;
  }

  async updateInventoryItem(id: number, orgId: number, data: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const [result] = await db.update(inventoryItems).set(data).where(and(eq(inventoryItems.id, id), eq(inventoryItems.organizationId, orgId))).returning();
    return result;
  }

  async deleteInventoryItem(id: number, orgId: number): Promise<boolean> {
    const result = await db.delete(inventoryItems).where(and(eq(inventoryItems.id, id), eq(inventoryItems.organizationId, orgId))).returning();
    return result.length > 0;
  }

  async getLowStockItems(orgId: number): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems).where(
      and(
        eq(inventoryItems.organizationId, orgId),
        sql`${inventoryItems.quantity}::numeric <= ${inventoryItems.reorderThreshold}::numeric`
      )
    );
  }

  async getOrders(orgId: number, status?: string): Promise<Order[]> {
    const conditions = [eq(orders.organizationId, orgId)];
    if (status) conditions.push(eq(orders.status, status));
    return await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: number, orgId: number): Promise<Order | undefined> {
    const [result] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, orgId)));
    return result;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [result] = await db.insert(orders).values(order).returning();
    return result;
  }

  async updateOrder(id: number, orgId: number, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const [result] = await db.update(orders).set(data).where(and(eq(orders.id, id), eq(orders.organizationId, orgId))).returning();
    return result;
  }

  async getTabs(orgId: number, status?: string): Promise<Tab[]> {
    const conditions = [eq(tabs.organizationId, orgId)];
    if (status) conditions.push(eq(tabs.status, status));
    return await db.select().from(tabs).where(and(...conditions)).orderBy(desc(tabs.createdAt));
  }

  async getTab(id: number, orgId: number): Promise<Tab | undefined> {
    const [result] = await db.select().from(tabs).where(and(eq(tabs.id, id), eq(tabs.organizationId, orgId)));
    return result;
  }

  async getTabByCustomer(customerName: string, orgId: number): Promise<Tab | undefined> {
    const [result] = await db.select().from(tabs).where(
      and(ilike(tabs.customerName, customerName), eq(tabs.organizationId, orgId), eq(tabs.status, "open"))
    );
    return result;
  }

  async createTab(tab: InsertTab): Promise<Tab> {
    const [result] = await db.insert(tabs).values(tab).returning();
    return result;
  }

  async updateTab(id: number, orgId: number, data: Partial<InsertTab>): Promise<Tab | undefined> {
    const [result] = await db.update(tabs).set(data).where(and(eq(tabs.id, id), eq(tabs.organizationId, orgId))).returning();
    return result;
  }

  async getBookings(orgId: number, status?: string): Promise<Booking[]> {
    const conditions = [eq(bookings.organizationId, orgId)];
    if (status) conditions.push(eq(bookings.status, status));
    return await db.select().from(bookings).where(and(...conditions)).orderBy(bookings.eventDate);
  }

  async getBooking(id: number, orgId: number): Promise<Booking | undefined> {
    const [result] = await db.select().from(bookings).where(and(eq(bookings.id, id), eq(bookings.organizationId, orgId)));
    return result;
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [result] = await db.insert(bookings).values(booking).returning();
    return result;
  }

  async updateBooking(id: number, orgId: number, data: Partial<InsertBooking>): Promise<Booking | undefined> {
    const [result] = await db.update(bookings).set(data).where(and(eq(bookings.id, id), eq(bookings.organizationId, orgId))).returning();
    return result;
  }

  async deleteBooking(id: number, orgId: number): Promise<boolean> {
    const result = await db.delete(bookings).where(and(eq(bookings.id, id), eq(bookings.organizationId, orgId))).returning();
    return result.length > 0;
  }

  async getAvailableDates(orgId: number): Promise<string[]> {
    const existingBookings = await db.select({ date: bookings.eventDate }).from(bookings).where(
      and(eq(bookings.organizationId, orgId), gte(bookings.eventDate, sql`CURRENT_DATE`))
    );
    const bookedDates = new Set(existingBookings.map(b => b.date));
    const available: string[] = [];
    const now = new Date();
    for (let i = 1; i <= 42; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      if (!bookedDates.has(dateStr)) available.push(dateStr);
      if (available.length >= 10) break;
    }
    return available;
  }

  async getStaffMembers(orgId: number): Promise<StaffMember[]> {
    return await db.select().from(staffMembers).where(eq(staffMembers.organizationId, orgId));
  }

  async getStaffMember(id: number, orgId: number): Promise<StaffMember | undefined> {
    const [result] = await db.select().from(staffMembers).where(and(eq(staffMembers.id, id), eq(staffMembers.organizationId, orgId)));
    return result;
  }

  async createStaffMember(member: InsertStaffMember): Promise<StaffMember> {
    const [result] = await db.insert(staffMembers).values(member).returning();
    return result;
  }

  async updateStaffMember(id: number, orgId: number, data: Partial<InsertStaffMember>): Promise<StaffMember | undefined> {
    const [result] = await db.update(staffMembers).set(data).where(and(eq(staffMembers.id, id), eq(staffMembers.organizationId, orgId))).returning();
    return result;
  }

  async deleteStaffMember(id: number, orgId: number): Promise<boolean> {
    const result = await db.delete(staffMembers).where(and(eq(staffMembers.id, id), eq(staffMembers.organizationId, orgId))).returning();
    return result.length > 0;
  }

  async getStaffShifts(orgId: number, date?: string): Promise<(StaffShift & { staffName?: string; staffRole?: string })[]> {
    const conditions = [eq(staffShifts.organizationId, orgId)];
    if (date) conditions.push(eq(staffShifts.shiftDate, date));
    const rows = await db.select({
      id: staffShifts.id,
      staffMemberId: staffShifts.staffMemberId,
      shiftDate: staffShifts.shiftDate,
      startTime: staffShifts.startTime,
      endTime: staffShifts.endTime,
      organizationId: staffShifts.organizationId,
      staffName: staffMembers.name,
      staffRole: staffMembers.role,
    }).from(staffShifts)
      .leftJoin(staffMembers, eq(staffShifts.staffMemberId, staffMembers.id))
      .where(and(...conditions));
    return rows.map(r => ({ ...r, staffName: r.staffName || undefined, staffRole: r.staffRole || undefined }));
  }

  async createStaffShift(shift: InsertStaffShift): Promise<StaffShift> {
    const [result] = await db.insert(staffShifts).values(shift).returning();
    return result;
  }

  async deleteStaffShift(id: number, orgId: number): Promise<boolean> {
    const result = await db.delete(staffShifts).where(and(eq(staffShifts.id, id), eq(staffShifts.organizationId, orgId))).returning();
    return result.length > 0;
  }

  async getGuests(orgId: number, query?: string): Promise<Guest[]> {
    const conditions = [eq(guests.organizationId, orgId)];
    if (query) {
      conditions.push(
        sql`(${ilike(guests.name, `%${query}%`)} OR ${ilike(guests.email, `%${query}%`)} OR ${guests.phone} ILIKE ${'%' + query + '%'})`
      );
    }
    return await db.select().from(guests).where(and(...conditions));
  }

  async getGuest(id: number, orgId: number): Promise<Guest | undefined> {
    const [result] = await db.select().from(guests).where(and(eq(guests.id, id), eq(guests.organizationId, orgId)));
    return result;
  }

  async getGuestByName(name: string, orgId: number): Promise<Guest | undefined> {
    const [result] = await db.select().from(guests).where(and(ilike(guests.name, `%${name}%`), eq(guests.organizationId, orgId)));
    return result;
  }

  async createGuest(guest: InsertGuest): Promise<Guest> {
    const [result] = await db.insert(guests).values(guest).returning();
    return result;
  }

  async updateGuest(id: number, orgId: number, data: Partial<InsertGuest>): Promise<Guest | undefined> {
    const [result] = await db.update(guests).set(data).where(and(eq(guests.id, id), eq(guests.organizationId, orgId))).returning();
    return result;
  }

  async deleteGuest(id: number, orgId: number): Promise<boolean> {
    const result = await db.delete(guests).where(and(eq(guests.id, id), eq(guests.organizationId, orgId))).returning();
    return result.length > 0;
  }

  async getTasks(orgId: number, status?: string): Promise<Task[]> {
    const conditions = [eq(tasks.organizationId, orgId)];
    if (status) conditions.push(eq(tasks.status, status));
    return await db.select().from(tasks).where(and(...conditions)).orderBy(tasks.createdAt);
  }

  async getTask(id: number, orgId: number): Promise<Task | undefined> {
    const [result] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.organizationId, orgId)));
    return result;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [result] = await db.insert(tasks).values(task).returning();
    return result;
  }

  async updateTask(id: number, orgId: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [result] = await db.update(tasks).set(data).where(and(eq(tasks.id, id), eq(tasks.organizationId, orgId))).returning();
    return result;
  }

  async deleteTask(id: number, orgId: number): Promise<boolean> {
    const result = await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.organizationId, orgId))).returning();
    return result.length > 0;
  }

  async createWasteLog(log: InsertWasteLog): Promise<WasteLog> {
    const [result] = await db.insert(wasteLogs).values(log).returning();
    return result;
  }

  async getWasteLogs(orgId: number): Promise<WasteLog[]> {
    return await db.select().from(wasteLogs).where(eq(wasteLogs.organizationId, orgId)).orderBy(desc(wasteLogs.createdAt));
  }

  async getSuppliers(orgId: number): Promise<Supplier[]> {
    return await db.select().from(suppliers).where(eq(suppliers.organizationId, orgId));
  }

  async getSupplier(id: number, orgId: number): Promise<Supplier | undefined> {
    const [result] = await db.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.organizationId, orgId)));
    return result;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [result] = await db.insert(suppliers).values(supplier).returning();
    return result;
  }

  async updateSupplier(id: number, orgId: number, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [result] = await db.update(suppliers).set(data).where(and(eq(suppliers.id, id), eq(suppliers.organizationId, orgId))).returning();
    return result;
  }

  async deleteSupplier(id: number, orgId: number): Promise<boolean> {
    const result = await db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.organizationId, orgId))).returning();
    return result.length > 0;
  }

  async getRevenueStats(orgId: number, startDate?: string, endDate?: string): Promise<{ revenue: number; orderCount: number; avgOrder: number }> {
    const conditions = [eq(orders.organizationId, orgId), eq(orders.paymentStatus, "paid")];
    if (startDate) conditions.push(gte(orders.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(orders.createdAt, new Date(endDate)));

    const [result] = await db.select({
      revenue: sql<string>`COALESCE(SUM(${orders.total}::numeric), 0)`,
      orderCount: sql<string>`COUNT(*)`,
      avgOrder: sql<string>`COALESCE(AVG(${orders.total}::numeric), 0)`,
    }).from(orders).where(and(...conditions));

    return {
      revenue: parseFloat(result?.revenue || "0"),
      orderCount: parseInt(result?.orderCount || "0"),
      avgOrder: parseFloat(parseFloat(result?.avgOrder || "0").toFixed(2)),
    };
  }

  async getRagDocuments(agentId: number, orgId: number): Promise<RagDocument[]> {
    return db.select().from(ragDocuments)
      .where(and(eq(ragDocuments.agentId, agentId), eq(ragDocuments.organizationId, orgId)))
      .orderBy(desc(ragDocuments.createdAt));
  }

  async createRagDocument(doc: InsertRagDocument): Promise<RagDocument> {
    const [result] = await db.insert(ragDocuments).values(doc).returning();
    return result;
  }

  async deleteRagDocument(id: number, orgId: number): Promise<boolean> {
    const result = await db.delete(ragDocuments)
      .where(and(eq(ragDocuments.id, id), eq(ragDocuments.organizationId, orgId)));
    return (result.rowCount ?? 0) > 0;
  }

  async searchRagDocuments(agentId: number, orgId: number, query: string, maxResults: number = 5): Promise<RagDocument[]> {
    // Split query into individual words for broader matching
    const words = query.trim().split(/\s+/).filter(w => w.length >= 2);

    // Try matching each word against content and filename
    const conditions = [eq(ragDocuments.organizationId, orgId)];
    // If agentId is provided and non-zero, scope to that agent; otherwise search all org docs
    if (agentId > 0) {
      conditions.push(eq(ragDocuments.agentId, agentId));
    }

    if (words.length > 0) {
      // Match any word in content OR filename
      const wordConditions = words.map(w =>
        sql`(${ilike(ragDocuments.content, `%${w}%`)} OR ${ilike(ragDocuments.filename, `%${w}%`)})`
      );
      conditions.push(sql`(${sql.join(wordConditions, sql` OR `)})`);
    }

    return db.select().from(ragDocuments)
      .where(and(...conditions))
      .limit(maxResults);
  }

  async getDocumentById(id: number, orgId: number): Promise<RagDocument | undefined> {
    const [result] = await db.select().from(ragDocuments)
      .where(and(eq(ragDocuments.id, id), eq(ragDocuments.organizationId, orgId)));
    return result;
  }

  async listAllRagDocuments(orgId: number, agentId?: number): Promise<RagDocument[]> {
    const conditions = [eq(ragDocuments.organizationId, orgId)];
    if (agentId && agentId > 0) {
      conditions.push(eq(ragDocuments.agentId, agentId));
    }
    return db.select().from(ragDocuments)
      .where(and(...conditions))
      .orderBy(desc(ragDocuments.createdAt));
  }
}

export const storage = new DatabaseStorage();

export async function seedVenueData(orgId: number): Promise<void> {
  const menuSeed: InsertMenuItem[] = [
    { name: "Margarita", price: "12.00", category: "cocktails", description: "Classic lime margarita with salt rim", available: true, organizationId: orgId },
    { name: "Old Fashioned", price: "14.00", category: "cocktails", description: "Bourbon, bitters, sugar, orange peel", available: true, organizationId: orgId },
    { name: "Moscow Mule", price: "13.00", category: "cocktails", description: "Vodka, ginger beer, lime", available: true, organizationId: orgId },
    { name: "Mojito", price: "12.00", category: "cocktails", description: "Rum, mint, lime, soda", available: true, organizationId: orgId },
    { name: "Espresso Martini", price: "15.00", category: "cocktails", description: "Vodka, espresso, coffee liqueur", available: true, organizationId: orgId },
    { name: "Bud Light", price: "6.00", category: "beer", description: "Light lager, 12oz draft", available: true, organizationId: orgId },
    { name: "IPA", price: "8.00", category: "beer", description: "Local craft IPA, 16oz", available: true, organizationId: orgId },
    { name: "Chardonnay", price: "11.00", category: "wine", description: "California Chardonnay, 6oz pour", available: true, organizationId: orgId },
    { name: "Cabernet Sauvignon", price: "13.00", category: "wine", description: "Napa Valley Cabernet, 6oz pour", available: true, organizationId: orgId },
    { name: "Prosecco", price: "10.00", category: "wine", description: "Italian sparkling wine, 6oz pour", available: true, organizationId: orgId },
    { name: "Tito's Vodka", price: "10.00", category: "spirits", description: "Tito's handmade vodka, neat or mixed", available: true, organizationId: orgId },
    { name: "Jack Daniels", price: "10.00", category: "spirits", description: "Tennessee whiskey, neat or on the rocks", available: true, organizationId: orgId },
    { name: "Hendrick's Gin", price: "12.00", category: "spirits", description: "Scottish gin with cucumber and rose", available: true, organizationId: orgId },
    { name: "Patron Silver", price: "14.00", category: "spirits", description: "Premium silver tequila", available: true, organizationId: orgId },
    { name: "Nachos", price: "12.00", category: "food", description: "Loaded nachos with cheese, jalapeños, salsa", available: true, organizationId: orgId },
    { name: "Wings", price: "14.00", category: "food", description: "Buffalo wings with ranch, 12ct", available: true, organizationId: orgId },
    { name: "Sliders", price: "16.00", category: "food", description: "Three beef sliders with fries", available: true, organizationId: orgId },
    { name: "Fries", price: "8.00", category: "food", description: "Crispy seasoned fries", available: true, organizationId: orgId },
  ];

  const inventorySeed: InsertInventoryItem[] = [
    { name: "Tito's Vodka", quantity: "12", unit: "bottles", cost: "22.00", reorderThreshold: "5", supplier: "Premier Spirits", organizationId: orgId },
    { name: "Jack Daniels", quantity: "8", unit: "bottles", cost: "28.00", reorderThreshold: "5", supplier: "Premier Spirits", organizationId: orgId },
    { name: "Hendrick's Gin", quantity: "3", unit: "bottles", cost: "35.00", reorderThreshold: "4", supplier: "Premier Spirits", organizationId: orgId },
    { name: "Patron Silver", quantity: "6", unit: "bottles", cost: "42.00", reorderThreshold: "3", supplier: "Premier Spirits", organizationId: orgId },
    { name: "Bud Light", quantity: "48", unit: "cans", cost: "0.75", reorderThreshold: "24", supplier: "Valley Beverage", organizationId: orgId },
    { name: "Prosecco", quantity: "15", unit: "bottles", cost: "12.00", reorderThreshold: "6", supplier: "Wine Direct", organizationId: orgId },
    { name: "Chardonnay", quantity: "10", unit: "bottles", cost: "14.00", reorderThreshold: "4", supplier: "Wine Direct", organizationId: orgId },
    { name: "Cabernet Sauvignon", quantity: "8", unit: "bottles", cost: "18.00", reorderThreshold: "4", supplier: "Wine Direct", organizationId: orgId },
    { name: "Limes", quantity: "25", unit: "pieces", cost: "0.30", reorderThreshold: "10", supplier: "Fresh Produce Co", organizationId: orgId },
    { name: "Lemons", quantity: "18", unit: "pieces", cost: "0.35", reorderThreshold: "10", supplier: "Fresh Produce Co", organizationId: orgId },
    { name: "Simple Syrup", quantity: "4", unit: "bottles", cost: "5.00", reorderThreshold: "2", supplier: "Bar Supplies Inc", organizationId: orgId },
    { name: "Ice", quantity: "200", unit: "lbs", cost: "0.05", reorderThreshold: "50", supplier: "Arctic Ice", organizationId: orgId },
    { name: "Ginger Beer", quantity: "36", unit: "bottles", cost: "1.50", reorderThreshold: "12", supplier: "Valley Beverage", organizationId: orgId },
    { name: "Coffee Liqueur", quantity: "4", unit: "bottles", cost: "24.00", reorderThreshold: "2", supplier: "Premier Spirits", organizationId: orgId },
    { name: "Bitters", quantity: "6", unit: "bottles", cost: "12.00", reorderThreshold: "2", supplier: "Bar Supplies Inc", organizationId: orgId },
  ];

  const supplierSeed: InsertSupplier[] = [
    { name: "Premier Spirits", contactName: "Mike Thompson", email: "mike@premierspirits.com", phone: "555-0101", items: "Vodka, Whiskey, Gin, Tequila, Liqueurs", organizationId: orgId },
    { name: "Valley Beverage", contactName: "Sarah Chen", email: "sarah@valleybev.com", phone: "555-0102", items: "Beer, Soda, Mixers, Ginger Beer", organizationId: orgId },
    { name: "Wine Direct", contactName: "Jean-Pierre Dubois", email: "jp@winedirect.com", phone: "555-0103", items: "Wine, Champagne, Prosecco", organizationId: orgId },
    { name: "Fresh Produce Co", contactName: "Maria Garcia", email: "maria@freshproduce.com", phone: "555-0104", items: "Limes, Lemons, Mint, Fruit garnishes", organizationId: orgId },
    { name: "Bar Supplies Inc", contactName: "Dave Wilson", email: "dave@barsupplies.com", phone: "555-0105", items: "Syrups, Bitters, Glassware, Napkins", organizationId: orgId },
  ];

  const staffSeed: InsertStaffMember[] = [
    { name: "Alex Rivera", role: "Head Bartender", email: "alex@venue.com", phone: "555-1001", organizationId: orgId },
    { name: "Jordan Kim", role: "Server", email: "jordan@venue.com", phone: "555-1002", organizationId: orgId },
    { name: "Sam Patel", role: "Host", email: "sam@venue.com", phone: "555-1003", organizationId: orgId },
    { name: "Taylor Brooks", role: "Bartender", email: "taylor@venue.com", phone: "555-1004", organizationId: orgId },
    { name: "Casey Morgan", role: "Server", email: "casey@venue.com", phone: "555-1005", organizationId: orgId },
  ];

  const guestSeed: InsertGuest[] = [
    { name: "James Wilson", email: "james.w@email.com", phone: "555-2001", notes: "Prefers Old Fashioned, birthday in March", visitCount: 12, totalSpent: "486.50", vipStatus: true, organizationId: orgId },
    { name: "Emily Chen", email: "emily.c@email.com", phone: "555-2002", notes: "Wine enthusiast, likes Cabernet", visitCount: 8, totalSpent: "312.00", vipStatus: true, organizationId: orgId },
    { name: "Michael Brown", email: "mike.b@email.com", phone: "555-2003", notes: "Usually orders wings and IPA", visitCount: 5, totalSpent: "145.00", vipStatus: false, organizationId: orgId },
    { name: "Sarah Davis", email: "sarah.d@email.com", phone: "555-2004", notes: "Cocktail lover, tries new drinks", visitCount: 15, totalSpent: "720.00", vipStatus: true, organizationId: orgId },
  ];

  await db.insert(menuItems).values(menuSeed);
  await db.insert(inventoryItems).values(inventorySeed);
  await db.insert(suppliers).values(supplierSeed);
  await db.insert(staffMembers).values(staffSeed);
  await db.insert(guests).values(guestSeed);
}
