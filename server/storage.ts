import { type WaitlistEntry, type InsertWaitlistEntry, waitlist } from "@shared/schema";
import { db } from "./db";

export interface IStorage {
  addToWaitlist(entry: InsertWaitlistEntry): Promise<WaitlistEntry>;
  getWaitlistEntries(): Promise<WaitlistEntry[]>;
}

export class DatabaseStorage implements IStorage {
  async addToWaitlist(entry: InsertWaitlistEntry): Promise<WaitlistEntry> {
    const [result] = await db.insert(waitlist).values(entry).returning();
    return result;
  }

  async getWaitlistEntries(): Promise<WaitlistEntry[]> {
    return await db.select().from(waitlist);
  }
}

export const storage = new DatabaseStorage();
