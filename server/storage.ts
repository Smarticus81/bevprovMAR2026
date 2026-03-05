import {
  type Organization, type InsertOrg, organizations,
  type User, type InsertUser, users,
  type Agent, type InsertAgent, agents,
  type AgentTool, type InsertAgentTool, agentTools,
  type WaitlistEntry, type InsertWaitlistEntry, waitlist,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
