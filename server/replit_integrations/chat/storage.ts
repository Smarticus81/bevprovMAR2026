import { db } from "../../db";
import { conversations, messages } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: number, orgId: number): Promise<typeof conversations.$inferSelect | undefined>;
  getAllConversations(orgId: number): Promise<(typeof conversations.$inferSelect)[]>;
  createConversation(title: string, orgId: number, venueId?: number): Promise<typeof conversations.$inferSelect>;
  deleteConversation(id: number, orgId: number): Promise<void>;
  getMessagesByConversation(conversationId: number, orgId: number): Promise<(typeof messages.$inferSelect)[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<typeof messages.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number, orgId: number) {
    const [conversation] = await db.select().from(conversations).where(
      and(eq(conversations.id, id), eq(conversations.organizationId, orgId))
    );
    return conversation;
  },

  async getAllConversations(orgId: number) {
    return db.select().from(conversations)
      .where(eq(conversations.organizationId, orgId))
      .orderBy(desc(conversations.createdAt));
  },

  async createConversation(title: string, orgId: number, venueId?: number) {
    const [conversation] = await db.insert(conversations).values({
      title,
      organizationId: orgId,
      ...(venueId ? { venueId } : {}),
    }).returning();
    return conversation;
  },

  async deleteConversation(id: number, orgId: number) {
    // Verify ownership before deleting
    const [conversation] = await db.select().from(conversations).where(
      and(eq(conversations.id, id), eq(conversations.organizationId, orgId))
    );
    if (!conversation) return;
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  },

  async getMessagesByConversation(conversationId: number, orgId: number) {
    // Verify conversation ownership first
    const [conversation] = await db.select().from(conversations).where(
      and(eq(conversations.id, conversationId), eq(conversations.organizationId, orgId))
    );
    if (!conversation) return [];
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const [message] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return message;
  },
};

