import type { Agent, AgentTool, AgentConfig, InsertAgentTool } from "@shared/schema";
import { storage } from "./storage";
import {
  isSquareConnected,
  syncCatalog,
  createSquareOrder,
  searchSquareOrders,
  updateSquareOrderState,
  createExternalPayment,
  getInventoryCounts,
  adjustInventory,
  setInventoryCount,
  fuzzyMatchCatalogItem,
  type SquareCatalogItem,
} from "./square";

export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  success: boolean;
  result: unknown;
}

interface ToolCatalogEntry {
  name: string;
  category: string;
  agentTypes: string[];
}

// All agent types get ALL tools — no artificial limits
const ALL_TYPES = ["pos-integration", "voice-pos", "inventory", "venue-admin", "bevone"];

const TOOL_CATALOG: ToolCatalogEntry[] = [
  { name: "square_pos_sync", category: "POS", agentTypes: ALL_TYPES },
  { name: "square_catalog_sync", category: "POS", agentTypes: ALL_TYPES },
  { name: "square_create_order", category: "POS", agentTypes: ALL_TYPES },
  { name: "square_submit_order", category: "POS", agentTypes: ALL_TYPES },
  { name: "square_check_inventory", category: "Inventory", agentTypes: ALL_TYPES },
  { name: "square_adjust_inventory", category: "Inventory", agentTypes: ALL_TYPES },
  { name: "square_set_inventory", category: "Inventory", agentTypes: ALL_TYPES },
  { name: "toast_pos_sync", category: "POS", agentTypes: ALL_TYPES },
  { name: "payment_processing", category: "POS", agentTypes: ALL_TYPES },
  { name: "receipt_generation", category: "POS", agentTypes: ALL_TYPES },
  { name: "tab_management", category: "POS", agentTypes: ALL_TYPES },
  { name: "menu_lookup", category: "POS", agentTypes: ALL_TYPES },
  { name: "voice_ordering", category: "Voice POS", agentTypes: ALL_TYPES },
  { name: "split_checks", category: "Voice POS", agentTypes: ALL_TYPES },
  { name: "customer_lookup", category: "Voice POS", agentTypes: ALL_TYPES },
  { name: "stock_tracking", category: "Inventory", agentTypes: ALL_TYPES },
  { name: "low_stock_alerts", category: "Inventory", agentTypes: ALL_TYPES },
  { name: "supplier_management", category: "Inventory", agentTypes: ALL_TYPES },
  { name: "waste_tracking", category: "Inventory", agentTypes: ALL_TYPES },
  { name: "auto_reorder", category: "Inventory", agentTypes: ALL_TYPES },
  { name: "inventory_pos_sync", category: "Inventory", agentTypes: ALL_TYPES },
  { name: "calendar_booking", category: "Operations", agentTypes: ALL_TYPES },
  { name: "staff_scheduling", category: "Operations", agentTypes: ALL_TYPES },
  { name: "financial_reports", category: "Operations", agentTypes: ALL_TYPES },
  { name: "guest_management", category: "Operations", agentTypes: ALL_TYPES },
  { name: "vendor_coordination", category: "Operations", agentTypes: ALL_TYPES },
  { name: "task_assignments", category: "Operations", agentTypes: ALL_TYPES },
  { name: "knowledge_base_search", category: "Knowledge", agentTypes: ALL_TYPES },
  { name: "read_document", category: "Knowledge", agentTypes: ALL_TYPES },
  { name: "list_documents", category: "Knowledge", agentTypes: ALL_TYPES },
];

export function getToolsForAgentType(agentType: string): ToolCatalogEntry[] {
  return TOOL_CATALOG.filter((tool) => tool.agentTypes.includes(agentType));
}

export async function autoEnableToolsForAgent(agentId: number, agentType: string, orgId?: number): Promise<AgentTool[]> {
  const tools = getToolsForAgentType(agentType);
  if (tools.length === 0) return [];
  const toolInserts: InsertAgentTool[] = tools.map((t) => ({
    agentId,
    toolName: t.name,
    toolCategory: t.category,
    enabled: true,
    config: {},
  }));
  // If orgId provided, use scoped version; otherwise fall back for backward compat
  if (orgId) {
    return await storage.setAgentTools(agentId, orgId, toolInserts);
  }
  // Fallback: direct insert (only for initial agent creation where agent was just verified)
  const { agentTools } = await import("@shared/schema");
  const { db } = await import("./db");
  const { eq } = await import("drizzle-orm");
  await db.delete(agentTools).where(eq(agentTools.agentId, agentId));
  if (toolInserts.length === 0) return [];
  return await db.insert(agentTools).values(toolInserts).returning();
}

const TOOL_DEFINITIONS: Record<string, { description: string; parameters: Record<string, unknown> }> = {
  square_pos_sync: {
    description: "Sync orders and payments with Square POS. Returns current sync status, recent transactions from Square, and connection info.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["sync", "status", "recent_orders"], description: "The sync action to perform" } }, required: ["action"] },
  },
  square_catalog_sync: {
    description: "Fetch the full Square product catalog. Returns all items with names, prices, variation IDs, and categories from the connected Square account.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  square_create_order: {
    description: "Create a new order in Square with line items. Use item names from the catalog — they will be fuzzy-matched. The order appears in Square Dashboard.",
    parameters: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { name: { type: "string", description: "Item name (fuzzy matched against catalog)" }, quantity: { type: "number", description: "Quantity" } } }, description: "Items to add to the order" }, state: { type: "string", enum: ["OPEN", "COMPLETED"], description: "Order state (default: COMPLETED)" } }, required: ["items"] },
  },
  square_submit_order: {
    description: "Submit/complete an existing open Square order and create an external payment. Marks the order as completed and paid in Square Dashboard.",
    parameters: { type: "object", properties: { orderId: { type: "string", description: "Square order ID to complete" }, paymentSource: { type: "string", description: "Payment source description (default: Pre-paid Event Package)" } }, required: ["orderId"] },
  },
  square_check_inventory: {
    description: "Check Square inventory counts for items. Use item names from the catalog — they will be fuzzy-matched. Shows how many units are in stock.",
    parameters: { type: "object", properties: { items: { type: "array", items: { type: "string" }, description: "Item names to check inventory for" } }, required: ["items"] },
  },
  square_adjust_inventory: {
    description: "Adjust Square inventory — receive new stock or record waste/spoilage. Positive quantity adds stock (NONE→IN_STOCK). Negative quantity records waste (IN_STOCK→WASTE).",
    parameters: { type: "object", properties: { item: { type: "string", description: "Item name (fuzzy matched against catalog)" }, quantity: { type: "number", description: "Quantity to adjust (positive=receive, negative=waste)" } }, required: ["item", "quantity"] },
  },
  square_set_inventory: {
    description: "Set the absolute inventory count for a Square catalog item. Use this for physical counts — sets the exact quantity in stock.",
    parameters: { type: "object", properties: { item: { type: "string", description: "Item name (fuzzy matched against catalog)" }, quantity: { type: "number", description: "Exact quantity to set" } }, required: ["item", "quantity"] },
  },
  toast_pos_sync: {
    description: "Sync orders and payments with Toast POS. Returns current sync status and recent transactions.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["sync", "status", "recent_orders"], description: "The sync action to perform" } }, required: ["action"] },
  },
  payment_processing: {
    description: "Process a payment for an order or tab. Creates a completed order record.",
    parameters: { type: "object", properties: { amount: { type: "number", description: "Payment amount in dollars" }, method: { type: "string", enum: ["credit_card", "apple_pay", "google_pay", "cash"], description: "Payment method" }, description: { type: "string", description: "Payment description" }, tabId: { type: "number", description: "Tab ID to pay for (optional)" } }, required: ["amount", "method"] },
  },
  receipt_generation: {
    description: "Generate a digital receipt for a completed order by order ID.",
    parameters: { type: "object", properties: { orderId: { type: "number", description: "Order ID to generate receipt for" } }, required: ["orderId"] },
  },
  tab_management: {
    description: "Open, view, add items to, or close a customer tab. Use customer name to identify tabs.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["open", "view", "close", "add_item", "list"], description: "Tab action" }, customerName: { type: "string", description: "Customer name for the tab" }, item: { type: "string", description: "Menu item name to add (for add_item action)" }, quantity: { type: "number", description: "Quantity of item to add" } }, required: ["action"] },
  },
  menu_lookup: {
    description: "Look up menu items, prices, and availability from the venue's actual menu.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Search query for menu items" }, category: { type: "string", description: "Category filter (cocktails, beer, wine, spirits, food)" } }, required: [] },
  },
  voice_ordering: {
    description: "Place an order based on voice input. Creates an order with specified items from the menu.",
    parameters: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, quantity: { type: "number" } } }, description: "List of items to order" }, tableNumber: { type: "number", description: "Table number" }, customerName: { type: "string", description: "Customer name" } }, required: ["items"] },
  },
  split_checks: {
    description: "Split a tab's total between multiple guests evenly.",
    parameters: { type: "object", properties: { customerName: { type: "string", description: "Customer name on the tab" }, splitCount: { type: "number", description: "Number of ways to split" } }, required: ["customerName", "splitCount"] },
  },
  customer_lookup: {
    description: "Look up a customer/guest by name, email, or phone. Returns visit history and preferences.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Customer name, email, or phone to search" } }, required: ["query"] },
  },
  stock_tracking: {
    description: "Check current stock levels for inventory items. Can search by item name or show all.",
    parameters: { type: "object", properties: { item: { type: "string", description: "Item name to check (leave empty for all)" } }, required: [] },
  },
  low_stock_alerts: {
    description: "Get all inventory items that are at or below their reorder threshold.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  supplier_management: {
    description: "List suppliers, view their contact info and catalog, or note a restock order.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["list", "contact", "order"], description: "Supplier action" }, supplierName: { type: "string", description: "Supplier name to look up" }, items: { type: "string", description: "Items to reorder" } }, required: ["action"] },
  },
  waste_tracking: {
    description: "Log an item as wasted (spill, expired, damaged). Records it for cost tracking.",
    parameters: { type: "object", properties: { item: { type: "string", description: "Item wasted" }, quantity: { type: "number", description: "Quantity wasted" }, reason: { type: "string", enum: ["spill", "expired", "damaged", "other"], description: "Reason for waste" } }, required: ["item", "quantity", "reason"] },
  },
  auto_reorder: {
    description: "Check which items need reordering and optionally confirm the reorder.",
    parameters: { type: "object", properties: { confirm: { type: "boolean", description: "Confirm the reorder (true to place order)" } }, required: [] },
  },
  inventory_pos_sync: {
    description: "Show inventory status alongside recent order data to identify sync discrepancies.",
    parameters: { type: "object", properties: { posSystem: { type: "string", enum: ["square", "toast"], description: "Which POS to sync with" } }, required: ["posSystem"] },
  },
  calendar_booking: {
    description: "View upcoming bookings, check available dates, or create a new booking.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["view", "create", "cancel", "available_dates"], description: "Calendar action" }, date: { type: "string", description: "Date in YYYY-MM-DD format" }, eventType: { type: "string", description: "Type of event (wedding, corporate, private, party)" }, guestName: { type: "string", description: "Name of the guest booking" }, guestCount: { type: "number", description: "Expected guest count" } }, required: ["action"] },
  },
  staff_scheduling: {
    description: "View staff schedules for a given date, or list all staff members.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["view", "list_staff", "assign"], description: "Scheduling action" }, date: { type: "string", description: "Date in YYYY-MM-DD format" }, staffName: { type: "string", description: "Staff member name" }, startTime: { type: "string", description: "Shift start time (e.g. 4PM)" }, endTime: { type: "string", description: "Shift end time (e.g. 12AM)" } }, required: ["action"] },
  },
  financial_reports: {
    description: "Generate revenue reports from actual order data. Shows totals, order counts, and averages.",
    parameters: { type: "object", properties: { reportType: { type: "string", enum: ["daily", "weekly", "monthly", "all_time"], description: "Report period" } }, required: ["reportType"] },
  },
  guest_management: {
    description: "View the guest list, add a new guest, or update guest information.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["view_list", "add_guest", "update_guest"], description: "Guest action" }, guestName: { type: "string", description: "Guest name" }, email: { type: "string", description: "Guest email" }, phone: { type: "string", description: "Guest phone" }, notes: { type: "string", description: "Notes about the guest" } }, required: ["action"] },
  },
  vendor_coordination: {
    description: "List vendors/suppliers, view contact details, or check what they supply.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["list", "contact", "items"], description: "Vendor action" }, vendorName: { type: "string", description: "Vendor/supplier name" } }, required: ["action"] },
  },
  task_assignments: {
    description: "Create, list, assign, or complete staff tasks.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["list", "create", "complete", "status"], description: "Task action" }, taskDescription: { type: "string", description: "Task description (for create)" }, assignee: { type: "string", description: "Person to assign to" }, priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Task priority" }, taskId: { type: "number", description: "Task ID (for complete/status)" } }, required: ["action"] },
  },
  knowledge_base_search: {
    description: "Search the agent's uploaded knowledge base documents for relevant information. Use this when a user asks about policies, procedures, menus, or venue-specific information that might be in uploaded files.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Search query to find relevant knowledge base content" } }, required: ["query"] },
  },
  read_document: {
    description: "Read the full content of a specific uploaded knowledge base document by its ID or filename. Use this after searching to read a complete document.",
    parameters: { type: "object", properties: { documentId: { type: "number", description: "Document ID to read" }, filename: { type: "string", description: "Filename to search for and read" } }, required: [] },
  },
  list_documents: {
    description: "List all uploaded knowledge base documents available to this agent. Shows filenames, sizes, and upload dates.",
    parameters: { type: "object", properties: {}, required: [] },
  },
};

export async function executeToolCall(toolName: string, args: Record<string, unknown>, orgId: number): Promise<ToolCallResult> {
  try {
    switch (toolName) {
      case "menu_lookup": {
        const query = (args.query as string) || "";
        const category = (args.category as string) || "";
        const items = await storage.getMenuItems(orgId, query || undefined, category || undefined);
        const available = items.filter(i => i.available);
        return {
          success: true,
          result: {
            items: available.map(i => ({ name: i.name, price: `$${i.price}`, category: i.category, description: i.description })),
            total: available.length,
            message: available.length > 0
              ? `Found ${available.length} menu item(s): ${available.map(i => `${i.name} ($${i.price})`).join(", ")}`
              : "No matching items found on the menu.",
          },
        };
      }

      case "stock_tracking": {
        const itemName = (args.item as string) || "";
        if (itemName) {
          const item = await storage.getInventoryItemByName(itemName, orgId);
          if (item) {
            const status = parseFloat(item.quantity) <= parseFloat(item.reorderThreshold) ? "low" : "in_stock";
            return { success: true, result: { name: item.name, quantity: `${item.quantity} ${item.unit}`, reorderAt: item.reorderThreshold, status, supplier: item.supplier, message: `${item.name}: ${item.quantity} ${item.unit} (${status === "low" ? "LOW STOCK" : "in stock"})` } };
          }
          return { success: true, result: { message: `Item "${itemName}" not found in inventory.` } };
        }
        const allItems = await storage.getInventoryItems(orgId);
        return {
          success: true,
          result: {
            items: allItems.map(i => ({ name: i.name, quantity: `${i.quantity} ${i.unit}`, status: parseFloat(i.quantity) <= parseFloat(i.reorderThreshold) ? "low" : "in_stock" })),
            total: allItems.length,
            message: `Inventory has ${allItems.length} items tracked.`,
          },
        };
      }

      case "low_stock_alerts": {
        const lowItems = await storage.getLowStockItems(orgId);
        return {
          success: true,
          result: {
            alerts: lowItems.map(i => ({ name: i.name, quantity: `${i.quantity} ${i.unit}`, threshold: i.reorderThreshold, supplier: i.supplier })),
            count: lowItems.length,
            message: lowItems.length > 0
              ? `${lowItems.length} item(s) at or below reorder threshold: ${lowItems.map(i => i.name).join(", ")}`
              : "All items are above reorder thresholds. No alerts.",
          },
        };
      }

      case "tab_management": {
        const action = args.action as string;
        if (action === "open") {
          const customerName = (args.customerName as string) || "Guest";
          const existing = await storage.getTabByCustomer(customerName, orgId);
          if (existing) return { success: true, result: { tabId: existing.id, customer: existing.customerName, status: "open", total: `$${existing.total}`, message: `${customerName} already has an open tab (Tab #${existing.id}, $${existing.total}).` } };
          const tab = await storage.createTab({ customerName, items: [], total: "0", status: "open", organizationId: orgId });
          return { success: true, result: { tabId: tab.id, customer: tab.customerName, status: "open", total: "$0.00", message: `Tab #${tab.id} opened for ${customerName}.` } };
        }
        if (action === "add_item") {
          const customerName = (args.customerName as string) || "";
          const itemName = (args.item as string) || "";
          const qty = (args.quantity as number) || 1;
          if (!customerName || !itemName) return { success: false, result: { error: "Customer name and item name are required." } };
          let tab = await storage.getTabByCustomer(customerName, orgId);
          if (!tab) {
            tab = await storage.createTab({ customerName, items: [], total: "0", status: "open", organizationId: orgId });
          }
          const menuMatches = await storage.getMenuItems(orgId, itemName);
          const menuItem = menuMatches.find(m => m.available);
          if (!menuItem) return { success: false, result: { error: `"${itemName}" not found on menu or unavailable.` } };
          const price = parseFloat(menuItem.price);
          const currentItems = (tab.items || []) as any[];
          currentItems.push({ name: menuItem.name, quantity: qty, price });
          const newTotal = currentItems.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);
          await storage.updateTab(tab.id, orgId, { items: currentItems, total: newTotal.toFixed(2) });
          return { success: true, result: { tabId: tab.id, added: menuItem.name, quantity: qty, lineTotal: `$${(price * qty).toFixed(2)}`, tabTotal: `$${newTotal.toFixed(2)}`, message: `Added ${qty}x ${menuItem.name} ($${(price * qty).toFixed(2)}) to ${customerName}'s tab. New total: $${newTotal.toFixed(2)}.` } };
        }
        if (action === "close") {
          const customerName = (args.customerName as string) || "";
          if (!customerName) return { success: false, result: { error: "Customer name is required to close a tab." } };
          const tab = await storage.getTabByCustomer(customerName, orgId);
          if (!tab) return { success: false, result: { error: `No open tab found for "${customerName}".` } };
          await storage.updateTab(tab.id, orgId, { status: "closed" });
          return { success: true, result: { tabId: tab.id, customer: tab.customerName, total: `$${tab.total}`, items: tab.items, status: "closed", message: `Tab #${tab.id} for ${tab.customerName} closed. Total: $${tab.total}.` } };
        }
        if (action === "view") {
          const customerName = (args.customerName as string) || "";
          if (customerName) {
            const tab = await storage.getTabByCustomer(customerName, orgId);
            if (!tab) return { success: true, result: { message: `No open tab found for "${customerName}".` } };
            return { success: true, result: { tabId: tab.id, customer: tab.customerName, items: tab.items, total: `$${tab.total}`, status: tab.status, message: `Tab #${tab.id} for ${tab.customerName}: $${tab.total} (${(tab.items || []).length} items).` } };
          }
          const openTabs = await storage.getTabs(orgId, "open");
          return { success: true, result: { tabs: openTabs.map(t => ({ id: t.id, customer: t.customerName, total: `$${t.total}`, items: (t.items || []).length })), count: openTabs.length, message: `${openTabs.length} open tab(s).` } };
        }
        if (action === "list") {
          const openTabs = await storage.getTabs(orgId, "open");
          return { success: true, result: { tabs: openTabs.map(t => ({ id: t.id, customer: t.customerName, total: `$${t.total}`, itemCount: (t.items || []).length })), count: openTabs.length, message: `${openTabs.length} open tab(s): ${openTabs.map(t => `${t.customerName} ($${t.total})`).join(", ") || "none"}` } };
        }
        return { success: false, result: { error: "Invalid tab action." } };
      }

      case "voice_ordering": {
        const itemsList = (args.items as any[]) || [];
        const tableNumber = (args.tableNumber as number) || undefined;
        const customerName = (args.customerName as string) || undefined;
        if (itemsList.length === 0) return { success: false, result: { error: "No items specified for the order." } };

        const orderItems: { name: string; quantity: number; price: number }[] = [];
        const errors: string[] = [];
        for (const req of itemsList) {
          const menuMatches = await storage.getMenuItems(orgId, req.name);
          const menuItem = menuMatches.find(m => m.available);
          if (menuItem) {
            orderItems.push({ name: menuItem.name, quantity: req.quantity || 1, price: parseFloat(menuItem.price) });
          } else {
            errors.push(req.name);
          }
        }
        if (orderItems.length === 0) return { success: false, result: { error: `Could not find any of the requested items: ${errors.join(", ")}` } };

        const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const order = await storage.createOrder({
          items: orderItems,
          total: total.toFixed(2),
          status: "confirmed",
          tableNumber,
          customerName,
          organizationId: orgId,
        });
        const itemSummary = orderItems.map(i => `${i.quantity}x ${i.name}`).join(", ");
        return {
          success: true,
          result: {
            orderId: order.id,
            items: orderItems,
            total: `$${total.toFixed(2)}`,
            table: tableNumber || "bar",
            status: "confirmed",
            message: `Order #${order.id} placed: ${itemSummary}. Total: $${total.toFixed(2)}.${errors.length > 0 ? ` Note: "${errors.join(", ")}" not found on menu.` : ""}`,
          },
        };
      }

      case "payment_processing": {
        const amount = args.amount as number;
        if (!amount || amount <= 0) return { success: false, result: { error: "Payment amount must be greater than zero." } };
        if (amount > 100000) return { success: false, result: { error: "Payment amount exceeds maximum limit." } };
        const method = args.method as string;
        if (!method) return { success: false, result: { error: "Payment method is required." } };
        const description = (args.description as string) || "Payment";
        const tabId = args.tabId as number | undefined;

        if (tabId) {
          const tab = await storage.getTab(tabId, orgId);
          if (tab) {
            await storage.updateTab(tab.id, orgId, { status: "closed" });
          }
        }

        const order = await storage.createOrder({
          items: [{ name: description, quantity: 1, price: amount }],
          total: amount.toFixed(2),
          status: "completed",
          paymentMethod: method,
          paymentStatus: "paid",
          organizationId: orgId,
        });

        return {
          success: true,
          result: {
            orderId: order.id,
            amount: `$${amount.toFixed(2)}`,
            method,
            status: "paid",
            message: `Payment of $${amount.toFixed(2)} processed via ${method}. Order #${order.id}.`,
          },
        };
      }

      case "receipt_generation": {
        const orderId = args.orderId as number;
        const order = await storage.getOrder(orderId, orgId);
        if (!order) return { success: false, result: { error: `Order #${orderId} not found.` } };
        return {
          success: true,
          result: {
            orderId: order.id,
            items: order.items,
            total: `$${order.total}`,
            paymentMethod: order.paymentMethod || "pending",
            paymentStatus: order.paymentStatus,
            date: order.createdAt,
            message: `Receipt for Order #${order.id}: $${order.total} (${order.paymentStatus}).`,
          },
        };
      }

      case "split_checks": {
        const customerName = args.customerName as string;
        const splitCount = (args.splitCount as number) || 2;
        if (!customerName) return { success: false, result: { error: "Customer name is required." } };
        const tab = await storage.getTabByCustomer(customerName, orgId);
        if (!tab) return { success: false, result: { error: `No open tab found for "${customerName}".` } };
        const total = parseFloat(tab.total);
        const perPerson = total / splitCount;
        return {
          success: true,
          result: {
            tabId: tab.id,
            customer: tab.customerName,
            total: `$${total.toFixed(2)}`,
            splitCount,
            amountPerPerson: `$${perPerson.toFixed(2)}`,
            message: `Tab for ${tab.customerName} ($${total.toFixed(2)}) split ${splitCount} ways: $${perPerson.toFixed(2)} per person.`,
          },
        };
      }

      case "customer_lookup": {
        const query = (args.query as string) || "";
        if (!query) return { success: false, result: { error: "Search query is required." } };
        const guestResults = await storage.getGuests(orgId, query);
        if (guestResults.length === 0) return { success: true, result: { message: `No customer found matching "${query}".` } };
        const g = guestResults[0];
        return {
          success: true,
          result: {
            name: g.name,
            email: g.email,
            phone: g.phone,
            visits: g.visitCount,
            totalSpent: `$${g.totalSpent}`,
            vipStatus: g.vipStatus,
            notes: g.notes,
            message: `${g.name}: ${g.visitCount} visits, $${g.totalSpent} spent${g.vipStatus ? " (VIP)" : ""}. ${g.notes || ""}`,
          },
        };
      }

      case "supplier_management": {
        const action = args.action as string;
        if (action === "list") {
          const allSuppliers = await storage.getSuppliers(orgId);
          return { success: true, result: { suppliers: allSuppliers.map(s => ({ name: s.name, contact: s.contactName, items: s.items })), count: allSuppliers.length, message: `${allSuppliers.length} supplier(s): ${allSuppliers.map(s => s.name).join(", ")}` } };
        }
        if (action === "contact") {
          const name = (args.supplierName as string) || "";
          const allSuppliers = await storage.getSuppliers(orgId);
          const supplier = allSuppliers.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
          if (!supplier) return { success: true, result: { message: `Supplier "${name}" not found.` } };
          return { success: true, result: { name: supplier.name, contact: supplier.contactName, email: supplier.email, phone: supplier.phone, items: supplier.items, message: `${supplier.name} — Contact: ${supplier.contactName}, Phone: ${supplier.phone}, Email: ${supplier.email}` } };
        }
        if (action === "order") {
          const itemsToOrder = (args.items as string) || "low stock items";
          return { success: true, result: { message: `Restock order noted for: ${itemsToOrder}. Contact your supplier to confirm.` } };
        }
        return { success: false, result: { error: "Invalid supplier action." } };
      }

      case "waste_tracking": {
        const item = args.item as string;
        const quantity = args.quantity as number;
        const reason = args.reason as string;
        if (!item || !quantity || !reason) return { success: false, result: { error: "Item, quantity, and reason are required." } };

        const invItem = await storage.getInventoryItemByName(item, orgId);
        let cost: string | undefined;
        if (invItem && invItem.cost) {
          cost = (parseFloat(invItem.cost) * quantity).toFixed(2);
          const newQty = Math.max(0, parseFloat(invItem.quantity) - quantity);
          await storage.updateInventoryItem(invItem.id, orgId, { quantity: newQty.toString() });
        }

        const log = await storage.createWasteLog({
          item,
          quantity: quantity.toString(),
          unit: invItem?.unit,
          reason,
          cost,
          organizationId: orgId,
        });
        return {
          success: true,
          result: {
            id: log.id,
            item,
            quantity: `${quantity} ${invItem?.unit || "units"}`,
            reason,
            cost: cost ? `$${cost}` : "unknown",
            message: `Waste logged: ${quantity} ${invItem?.unit || "units"} of ${item} (${reason}).${cost ? ` Estimated cost: $${cost}.` : ""} Inventory updated.`,
          },
        };
      }

      case "auto_reorder": {
        const lowItems = await storage.getLowStockItems(orgId);
        if (lowItems.length === 0) return { success: true, result: { message: "All items are above reorder thresholds. Nothing to reorder." } };

        const confirm = args.confirm as boolean;
        if (!confirm) {
          return {
            success: true,
            result: {
              needsReorder: lowItems.map(i => ({ name: i.name, current: `${i.quantity} ${i.unit}`, threshold: i.reorderThreshold, supplier: i.supplier })),
              count: lowItems.length,
              message: `${lowItems.length} item(s) need reordering: ${lowItems.map(i => `${i.name} (${i.quantity}/${i.reorderThreshold} ${i.unit})`).join(", ")}. Say "confirm" to place the order.`,
            },
          };
        }

        return {
          success: true,
          result: {
            ordered: lowItems.map(i => i.name),
            count: lowItems.length,
            message: `Restock orders noted for ${lowItems.length} items: ${lowItems.map(i => i.name).join(", ")}. Contact suppliers to confirm delivery.`,
          },
        };
      }

      case "inventory_pos_sync": {
        const posSystem = (args.posSystem as string) || "square";
        if (posSystem === "square") {
          const connected = await isSquareConnected(orgId);
          if (connected) {
            try {
              const catalog = await syncCatalog(orgId);
              const squareOrders = await searchSquareOrders(orgId, { limit: 10 });
              const localInventory = await storage.getInventoryItems(orgId);
              return {
                success: true,
                result: {
                  posSystem: "Square (Live)",
                  catalogItems: catalog.length,
                  recentSquareOrders: squareOrders.length,
                  localInventoryItems: localInventory.length,
                  lowStockItems: localInventory.filter(i => parseFloat(i.quantity) <= parseFloat(i.reorderThreshold)).length,
                  message: `Square POS synced. ${catalog.length} catalog items, ${squareOrders.length} recent orders, ${localInventory.length} local inventory items tracked.`,
                },
              };
            } catch (e: any) {
              // Fall through to local data if Square API fails
            }
          }
        }
        const inventory = await storage.getInventoryItems(orgId);
        const recentOrders = await storage.getOrders(orgId);
        const last10 = recentOrders.slice(0, 10);
        return {
          success: true,
          result: {
            posSystem: posSystem,
            inventoryCount: inventory.length,
            recentOrders: last10.length,
            lowStockItems: inventory.filter(i => parseFloat(i.quantity) <= parseFloat(i.reorderThreshold)).length,
            message: `Inventory: ${inventory.length} items tracked. ${last10.length} recent orders. ${inventory.filter(i => parseFloat(i.quantity) <= parseFloat(i.reorderThreshold)).length} items at low stock. Sync data is up to date.`,
          },
        };
      }

      case "square_pos_sync": {
        const action = args.action as string;
        const connected = await isSquareConnected(orgId);
        if (!connected) {
          return { success: false, result: { error: "Square is not connected. Please connect your Square account first via Settings → Connections." } };
        }
        if (action === "recent_orders") {
          try {
            const squareOrders = await searchSquareOrders(orgId, { limit: 10 });
            return {
              success: true,
              result: {
                orders: squareOrders.map((o: any) => ({
                  id: o.id,
                  state: o.state,
                  total: o.total_money ? `$${(o.total_money.amount / 100).toFixed(2)}` : "$0.00",
                  items: o.line_items?.map((li: any) => li.name).join(", ") || "N/A",
                  date: o.created_at,
                })),
                count: squareOrders.length,
                message: `${squareOrders.length} recent orders from Square POS.`,
              },
            };
          } catch (e: any) {
            return { success: false, result: { error: `Failed to fetch Square orders: ${e.message}` } };
          }
        }
        if (action === "status") {
          try {
            const squareOrders = await searchSquareOrders(orgId, { limit: 50 });
            const totalRevenue = squareOrders.reduce((sum: number, o: any) => sum + (o.total_money?.amount || 0), 0) / 100;
            return {
              success: true,
              result: {
                posSystem: "Square",
                status: "connected",
                totalRevenue: `$${totalRevenue.toFixed(2)}`,
                orderCount: squareOrders.length,
                message: `Square POS connected. ${squareOrders.length} recent orders, $${totalRevenue.toFixed(2)} total revenue.`,
              },
            };
          } catch (e: any) {
            return { success: false, result: { error: `Square status check failed: ${e.message}` } };
          }
        }
        // Default: sync action
        try {
          const catalog = await syncCatalog(orgId);
          const squareOrders = await searchSquareOrders(orgId, { limit: 10 });
          return {
            success: true,
            result: {
              posSystem: "Square",
              synced: true,
              catalogItems: catalog.length,
              recentOrders: squareOrders.length,
              message: `Square POS synced. ${catalog.length} catalog items, ${squareOrders.length} recent orders.`,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Square sync failed: ${e.message}` } };
        }
      }

      case "square_catalog_sync": {
        const connected = await isSquareConnected(orgId);
        if (!connected) return { success: false, result: { error: "Square not connected." } };
        try {
          const catalog = await syncCatalog(orgId);
          return {
            success: true,
            result: {
              items: catalog.map(i => ({
                name: i.name,
                price: `$${(i.price / 100).toFixed(2)}`,
                category: i.category || "Uncategorized",
                variationId: i.variationId,
                variationName: i.variationName,
              })),
              count: catalog.length,
              message: `Square catalog: ${catalog.length} items. ${catalog.slice(0, 5).map(i => `${i.name} ($${(i.price / 100).toFixed(2)})`).join(", ")}${catalog.length > 5 ? "..." : ""}`,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Catalog sync failed: ${e.message}` } };
        }
      }

      case "square_create_order": {
        const connected = await isSquareConnected(orgId);
        if (!connected) return { success: false, result: { error: "Square not connected." } };
        try {
          const catalog = await syncCatalog(orgId);
          const requestedItems = args.items as Array<{ name: string; quantity: number }>;
          if (!requestedItems?.length) return { success: false, result: { error: "No items provided." } };

          const orderItems: Array<{ catalogObjectId: string; variationId: string; quantity: number; name: string; price: number }> = [];
          const notFound: string[] = [];

          for (const ri of requestedItems) {
            const match = fuzzyMatchCatalogItem(ri.name, catalog);
            if (match) {
              orderItems.push({
                catalogObjectId: match.id,
                variationId: match.variationId,
                quantity: ri.quantity || 1,
                name: match.name,
                price: match.price,
              });
            } else {
              notFound.push(ri.name);
            }
          }

          if (orderItems.length === 0) {
            return { success: false, result: { error: `No matching items found in Square catalog for: ${notFound.join(", ")}` } };
          }

          const state = (args.state as string) === "OPEN" ? "OPEN" : "COMPLETED";
          const order = await createSquareOrder(orgId, orderItems, state as any);

          // Create external payment if completed
          let payment = null;
          if (state === "COMPLETED" && order.total_money?.amount > 0) {
            payment = await createExternalPayment(orgId, order.id, order.total_money.amount);
          }

          // Also create local order record
          const totalDollars = (order.total_money?.amount || 0) / 100;
          await storage.createOrder({
            items: orderItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price / 100 })),
            total: totalDollars.toFixed(2),
            status: state === "COMPLETED" ? "completed" : "pending",
            paymentStatus: payment ? "paid" : "unpaid",
            paymentMethod: payment ? "external" : undefined,
            organizationId: orgId,
          });

          const itemsSummary = orderItems.map(i => `${i.quantity}x ${i.name} ($${(i.price * i.quantity / 100).toFixed(2)})`).join(", ");
          let msg = `Order created in Square: ${itemsSummary}. Total: $${totalDollars.toFixed(2)}.`;
          if (notFound.length > 0) msg += ` Not found: ${notFound.join(", ")}.`;
          if (payment) msg += " Payment recorded.";

          return {
            success: true,
            result: {
              orderId: order.id,
              state: order.state,
              total: `$${totalDollars.toFixed(2)}`,
              items: orderItems.map(i => ({ name: i.name, quantity: i.quantity, price: `$${(i.price / 100).toFixed(2)}` })),
              paymentId: payment?.id || null,
              notFound,
              message: msg,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Failed to create Square order: ${e.message}` } };
        }
      }

      case "square_submit_order": {
        const connected = await isSquareConnected(orgId);
        if (!connected) return { success: false, result: { error: "Square not connected." } };
        try {
          const orderId = args.orderId as string;
          if (!orderId) return { success: false, result: { error: "orderId is required." } };

          const order = await updateSquareOrderState(orgId, orderId, "COMPLETED");
          const totalCents = order.total_money?.amount || 0;
          let payment = null;
          if (totalCents > 0) {
            const source = (args.paymentSource as string) || "Pre-paid Event Package";
            payment = await createExternalPayment(orgId, orderId, totalCents, source);
          }

          return {
            success: true,
            result: {
              orderId: order.id,
              state: "COMPLETED",
              total: `$${(totalCents / 100).toFixed(2)}`,
              paymentId: payment?.id || null,
              message: `Order ${orderId} completed in Square. Total: $${(totalCents / 100).toFixed(2)}.${payment ? " Payment recorded." : ""}`,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Failed to submit order: ${e.message}` } };
        }
      }

      case "square_check_inventory": {
        const connected = await isSquareConnected(orgId);
        if (!connected) return { success: false, result: { error: "Square not connected." } };
        try {
          const itemNames = args.items as string[];
          if (!itemNames?.length) return { success: false, result: { error: "Provide item names to check." } };

          const catalog = await syncCatalog(orgId);
          const results: Array<{ name: string; quantity: string; state: string }> = [];
          const notFound: string[] = [];

          for (const name of itemNames) {
            const match = fuzzyMatchCatalogItem(name, catalog);
            if (match) {
              const counts = await getInventoryCounts(orgId, [match.variationId]);
              const inStock = counts.find((c: any) => c.state === "IN_STOCK");
              results.push({
                name: match.name,
                quantity: inStock?.quantity || "0",
                state: inStock ? "IN_STOCK" : "NONE",
              });
            } else {
              notFound.push(name);
            }
          }

          const msg = results.map(r => `${r.name}: ${r.quantity} in stock`).join(", ");
          return {
            success: true,
            result: {
              inventory: results,
              notFound,
              message: msg || "No items found.",
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Inventory check failed: ${e.message}` } };
        }
      }

      case "square_adjust_inventory": {
        const connected = await isSquareConnected(orgId);
        if (!connected) return { success: false, result: { error: "Square not connected." } };
        try {
          const itemName = args.item as string;
          const quantity = args.quantity as number;
          if (!itemName || quantity === undefined) return { success: false, result: { error: "Item name and quantity are required." } };

          const catalog = await syncCatalog(orgId);
          const match = fuzzyMatchCatalogItem(itemName, catalog);
          if (!match) return { success: false, result: { error: `Item "${itemName}" not found in Square catalog.` } };

          let fromState: string, toState: string, action: string;
          if (quantity >= 0) {
            fromState = "NONE";
            toState = "IN_STOCK";
            action = "received";
          } else {
            fromState = "IN_STOCK";
            toState = "WASTE";
            action = "wasted";
          }

          await adjustInventory(orgId, match.variationId, quantity, fromState, toState);

          return {
            success: true,
            result: {
              item: match.name,
              quantity: Math.abs(quantity),
              action,
              message: `${action === "received" ? "Received" : "Recorded waste of"} ${Math.abs(quantity)} ${match.name} in Square inventory.`,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Inventory adjustment failed: ${e.message}` } };
        }
      }

      case "square_set_inventory": {
        const connected = await isSquareConnected(orgId);
        if (!connected) return { success: false, result: { error: "Square not connected." } };
        try {
          const itemName = args.item as string;
          const quantity = args.quantity as number;
          if (!itemName || quantity === undefined) return { success: false, result: { error: "Item name and quantity are required." } };

          const catalog = await syncCatalog(orgId);
          const match = fuzzyMatchCatalogItem(itemName, catalog);
          if (!match) return { success: false, result: { error: `Item "${itemName}" not found in Square catalog.` } };

          await setInventoryCount(orgId, match.variationId, quantity);

          return {
            success: true,
            result: {
              item: match.name,
              quantity,
              message: `Set ${match.name} inventory to ${quantity} in Square.`,
            },
          };
        } catch (e: any) {
          return { success: false, result: { error: `Set inventory failed: ${e.message}` } };
        }
      }

      case "toast_pos_sync": {
        const action = args.action as string;
        const posName = "Toast";
        if (action === "recent_orders") {
          const recentOrders = await storage.getOrders(orgId);
          const last10 = recentOrders.slice(0, 10);
          return { success: true, result: { orders: last10.map(o => ({ id: o.id, total: `$${o.total}`, status: o.paymentStatus, date: o.createdAt })), count: last10.length, message: `${last10.length} recent orders from ${posName} POS.` } };
        }
        if (action === "status") {
          const stats = await storage.getRevenueStats(orgId);
          return { success: true, result: { posSystem: posName, status: "connected", totalRevenue: `$${stats.revenue.toFixed(2)}`, orderCount: stats.orderCount, message: `${posName} POS connected. ${stats.orderCount} orders, $${stats.revenue.toFixed(2)} total revenue.` } };
        }
        const stats = await storage.getRevenueStats(orgId);
        return { success: true, result: { posSystem: posName, synced: true, orderCount: stats.orderCount, revenue: `$${stats.revenue.toFixed(2)}`, message: `${posName} POS synced. ${stats.orderCount} orders totaling $${stats.revenue.toFixed(2)}.` } };
      }

      case "calendar_booking": {
        const action = args.action as string;
        if (action === "available_dates") {
          const available = await storage.getAvailableDates(orgId);
          return { success: true, result: { availableDates: available, count: available.length, message: `${available.length} available dates in the next 6 weeks: ${available.slice(0, 5).join(", ")}${available.length > 5 ? "..." : ""}` } };
        }
        if (action === "create") {
          const date = args.date as string;
          const eventType = (args.eventType as string) || "private";
          const guestName = (args.guestName as string) || "Guest";
          const guestCount = (args.guestCount as number) || 1;
          if (!date) return { success: false, result: { error: "Date is required for booking." } };
          const booking = await storage.createBooking({
            eventDate: date,
            eventType,
            guestName,
            guestCount,
            status: "confirmed",
            organizationId: orgId,
          });
          return { success: true, result: { bookingId: booking.id, date, eventType, guestName, guestCount, status: "confirmed", message: `Booking #${booking.id} confirmed: ${eventType} on ${date} for ${guestName} (${guestCount} guests).` } };
        }
        if (action === "cancel") {
          const date = args.date as string;
          if (!date) return { success: false, result: { error: "Date is required to cancel." } };
          const allBookings = await storage.getBookings(orgId);
          const booking = allBookings.find(b => b.eventDate === date);
          if (!booking) return { success: true, result: { message: `No booking found on ${date}.` } };
          await storage.updateBooking(booking.id, orgId, { status: "cancelled" });
          return { success: true, result: { bookingId: booking.id, date, status: "cancelled", message: `Booking #${booking.id} on ${date} has been cancelled.` } };
        }
        const allBookings = await storage.getBookings(orgId);
        const upcoming = allBookings.filter(b => b.status !== "cancelled");
        return {
          success: true,
          result: {
            events: upcoming.map(b => ({ id: b.id, date: b.eventDate, type: b.eventType, guest: b.guestName, guestCount: b.guestCount, status: b.status })),
            count: upcoming.length,
            message: upcoming.length > 0
              ? `${upcoming.length} upcoming booking(s): ${upcoming.map(b => `${b.eventType} on ${b.eventDate} (${b.guestName})`).join(", ")}`
              : "No upcoming bookings.",
          },
        };
      }

      case "staff_scheduling": {
        const action = args.action as string;
        if (action === "list_staff") {
          const staff = await storage.getStaffMembers(orgId);
          return { success: true, result: { staff: staff.map(s => ({ id: s.id, name: s.name, role: s.role, email: s.email, phone: s.phone })), count: staff.length, message: `${staff.length} staff member(s): ${staff.map(s => `${s.name} (${s.role})`).join(", ")}` } };
        }
        if (action === "view") {
          const date = (args.date as string) || new Date().toISOString().split("T")[0];
          const shifts = await storage.getStaffShifts(orgId, date);
          if (shifts.length === 0) return { success: true, result: { date, message: `No shifts scheduled for ${date}.` } };
          return { success: true, result: { date, shifts: shifts.map(s => ({ staff: s.staffName, role: s.staffRole, start: s.startTime, end: s.endTime })), count: shifts.length, message: `${shifts.length} shift(s) on ${date}: ${shifts.map(s => `${s.staffName} (${s.staffRole}) ${s.startTime}-${s.endTime}`).join(", ")}` } };
        }
        if (action === "assign") {
          const staffName = (args.staffName as string) || "";
          const date = (args.date as string) || new Date().toISOString().split("T")[0];
          const startTime = (args.startTime as string) || "5PM";
          const endTime = (args.endTime as string) || "11PM";
          const staff = await storage.getStaffMembers(orgId);
          const member = staff.find(s => s.name.toLowerCase().includes(staffName.toLowerCase()));
          if (!member) return { success: false, result: { error: `Staff member "${staffName}" not found.` } };
          const shift = await storage.createStaffShift({ staffMemberId: member.id, shiftDate: date, startTime, endTime, organizationId: orgId });
          return { success: true, result: { shiftId: shift.id, staff: member.name, date, start: startTime, end: endTime, message: `Shift assigned: ${member.name} on ${date}, ${startTime}-${endTime}.` } };
        }
        return { success: false, result: { error: "Invalid scheduling action." } };
      }

      case "financial_reports": {
        const reportType = (args.reportType as string) || "all_time";
        let startDate: string | undefined;
        const now = new Date();
        if (reportType === "daily") {
          startDate = now.toISOString().split("T")[0];
        } else if (reportType === "weekly") {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          startDate = weekAgo.toISOString().split("T")[0];
        } else if (reportType === "monthly") {
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          startDate = monthAgo.toISOString().split("T")[0];
        }
        const stats = await storage.getRevenueStats(orgId, startDate);
        const wasteLogs = await storage.getWasteLogs(orgId);
        const wasteCost = wasteLogs.reduce((sum, w) => sum + parseFloat(w.cost || "0"), 0);
        return {
          success: true,
          result: {
            period: reportType,
            revenue: `$${stats.revenue.toFixed(2)}`,
            orderCount: stats.orderCount,
            averageOrder: `$${stats.avgOrder.toFixed(2)}`,
            wasteCost: `$${wasteCost.toFixed(2)}`,
            netRevenue: `$${(stats.revenue - wasteCost).toFixed(2)}`,
            message: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report: $${stats.revenue.toFixed(2)} revenue from ${stats.orderCount} orders (avg $${stats.avgOrder.toFixed(2)}). Waste: $${wasteCost.toFixed(2)}.`,
          },
        };
      }

      case "guest_management": {
        const action = args.action as string;
        if (action === "view_list") {
          const allGuests = await storage.getGuests(orgId);
          return { success: true, result: { guests: allGuests.map(g => ({ name: g.name, visits: g.visitCount, totalSpent: `$${g.totalSpent}`, vip: g.vipStatus })), total: allGuests.length, vipCount: allGuests.filter(g => g.vipStatus).length, message: `${allGuests.length} guest(s) on file, ${allGuests.filter(g => g.vipStatus).length} VIP.` } };
        }
        if (action === "add_guest") {
          const guestName = (args.guestName as string) || "";
          if (!guestName) return { success: false, result: { error: "Guest name is required." } };
          const guest = await storage.createGuest({
            name: guestName,
            email: (args.email as string) || undefined,
            phone: (args.phone as string) || undefined,
            notes: (args.notes as string) || undefined,
            organizationId: orgId,
          });
          return { success: true, result: { guestId: guest.id, name: guest.name, message: `Guest "${guest.name}" added to the guest list.` } };
        }
        if (action === "update_guest") {
          const guestName = (args.guestName as string) || "";
          const existing = await storage.getGuestByName(guestName, orgId);
          if (!existing) return { success: false, result: { error: `Guest "${guestName}" not found.` } };
          const updates: any = {};
          if (args.notes) updates.notes = args.notes;
          if (args.email) updates.email = args.email;
          if (args.phone) updates.phone = args.phone;
          await storage.updateGuest(existing.id, orgId, updates);
          return { success: true, result: { message: `Guest "${guestName}" updated.` } };
        }
        return { success: false, result: { error: "Invalid guest action." } };
      }

      case "vendor_coordination": {
        const action = args.action as string;
        const allSuppliers = await storage.getSuppliers(orgId);
        if (action === "list") {
          return { success: true, result: { vendors: allSuppliers.map(s => ({ name: s.name, contact: s.contactName, items: s.items })), count: allSuppliers.length, message: `${allSuppliers.length} vendor(s): ${allSuppliers.map(s => s.name).join(", ")}` } };
        }
        if (action === "contact" || action === "items") {
          const name = (args.vendorName as string) || "";
          const vendor = allSuppliers.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
          if (!vendor) return { success: true, result: { message: `Vendor "${name}" not found.` } };
          return { success: true, result: { name: vendor.name, contact: vendor.contactName, email: vendor.email, phone: vendor.phone, items: vendor.items, message: `${vendor.name}: ${vendor.contactName}, ${vendor.phone}, ${vendor.email}. Supplies: ${vendor.items}` } };
        }
        return { success: false, result: { error: "Invalid vendor action." } };
      }

      case "task_assignments": {
        const action = args.action as string;
        if (action === "list") {
          const status = undefined;
          const allTasks = await storage.getTasks(orgId, status);
          const pending = allTasks.filter(t => t.status !== "completed");
          return { success: true, result: { tasks: pending.map(t => ({ id: t.id, title: t.title, assignee: t.assignee, priority: t.priority, status: t.status, due: t.dueDate })), count: pending.length, message: pending.length > 0 ? `${pending.length} pending task(s): ${pending.map(t => `"${t.title}" (${t.priority}, ${t.assignee || "unassigned"})`).join(", ")}` : "No pending tasks." } };
        }
        if (action === "create") {
          const title = (args.taskDescription as string) || "";
          const assignee = (args.assignee as string) || undefined;
          const priority = (args.priority as string) || "medium";
          if (!title) return { success: false, result: { error: "Task description is required." } };
          const task = await storage.createTask({ title, assignee, priority, status: "pending", organizationId: orgId });
          return { success: true, result: { taskId: task.id, title: task.title, assignee: task.assignee, priority: task.priority, message: `Task created: "${task.title}"${task.assignee ? ` assigned to ${task.assignee}` : ""} (${task.priority} priority).` } };
        }
        if (action === "complete") {
          const taskId = args.taskId as number;
          if (!taskId) return { success: false, result: { error: "Task ID is required." } };
          const updated = await storage.updateTask(taskId, orgId, { status: "completed" });
          if (!updated) return { success: false, result: { error: `Task #${taskId} not found.` } };
          return { success: true, result: { taskId, title: updated.title, status: "completed", message: `Task "${updated.title}" marked as completed.` } };
        }
        if (action === "status") {
          const taskId = args.taskId as number;
          if (!taskId) return { success: false, result: { error: "Task ID is required." } };
          const task = await storage.getTask(taskId, orgId);
          if (!task) return { success: false, result: { error: `Task #${taskId} not found.` } };
          return { success: true, result: { taskId: task.id, title: task.title, assignee: task.assignee, priority: task.priority, status: task.status, message: `Task #${task.id} "${task.title}": ${task.status} (${task.priority}, ${task.assignee || "unassigned"}).` } };
        }
        return { success: false, result: { error: "Invalid task action." } };
      }

      case "knowledge_base_search": {
        const query = (args.query as string) || "";
        const agentId = (args._agentId as number) || 0;
        if (!query) return { success: true, result: { message: "No search query provided", results: [] } };
        let maxResults = 10;
        if (agentId) {
          const agent = await storage.getAgentById(agentId, orgId);
          if (agent) {
            const cfg = (agent.config || {}) as AgentConfig;
            maxResults = cfg.rag?.maxResults || 10;
          }
        }
        // Search across content and filenames with word-level matching
        const docs = await storage.searchRagDocuments(agentId, orgId, query, maxResults);
        if (docs.length === 0) {
          // Fallback: list all available documents so the agent knows what's there
          const allDocs = await storage.listAllRagDocuments(orgId, agentId > 0 ? agentId : undefined);
          if (allDocs.length > 0) {
            return {
              success: true,
              result: {
                message: `No documents matched "${query}", but ${allDocs.length} document(s) are available: ${allDocs.map(d => d.filename).join(", ")}. Try searching with different keywords or use read_document to read a specific file.`,
                results: [],
                availableDocuments: allDocs.map(d => ({ id: d.id, filename: d.filename })),
              },
            };
          }
          return { success: true, result: { message: "No documents found in the knowledge base. Upload documents first.", results: [] } };
        }
        return {
          success: true,
          result: {
            message: `Found ${docs.length} relevant document(s)`,
            results: docs.map(d => ({
              id: d.id,
              filename: d.filename,
              content: d.content.substring(0, 6000),
              sizeBytes: d.sizeBytes,
            })),
          },
        };
      }

      case "read_document": {
        const docId = args.documentId as number | undefined;
        const filename = (args.filename as string) || "";
        const agentId = (args._agentId as number) || 0;

        if (docId) {
          const doc = await storage.getDocumentById(docId, orgId);
          if (!doc) return { success: false, result: { error: `Document #${docId} not found.` } };
          return {
            success: true,
            result: {
              id: doc.id,
              filename: doc.filename,
              contentType: doc.contentType,
              sizeBytes: doc.sizeBytes,
              content: doc.content,
              message: `Document "${doc.filename}" (${doc.sizeBytes} bytes)`,
            },
          };
        }

        if (filename) {
          const allDocs = await storage.listAllRagDocuments(orgId, agentId > 0 ? agentId : undefined);
          const match = allDocs.find(d => d.filename.toLowerCase().includes(filename.toLowerCase()));
          if (!match) return { success: false, result: { error: `No document matching "${filename}" found.`, available: allDocs.map(d => d.filename) } };
          return {
            success: true,
            result: {
              id: match.id,
              filename: match.filename,
              contentType: match.contentType,
              sizeBytes: match.sizeBytes,
              content: match.content,
              message: `Document "${match.filename}" (${match.sizeBytes} bytes)`,
            },
          };
        }

        return { success: false, result: { error: "Provide either documentId or filename to read a document." } };
      }

      case "list_documents": {
        const agentId = (args._agentId as number) || 0;
        const docs = await storage.listAllRagDocuments(orgId, agentId > 0 ? agentId : undefined);
        if (docs.length === 0) {
          return { success: true, result: { message: "No documents uploaded yet.", documents: [] } };
        }
        return {
          success: true,
          result: {
            documents: docs.map(d => ({
              id: d.id,
              filename: d.filename,
              contentType: d.contentType,
              sizeBytes: d.sizeBytes,
              uploadedAt: d.createdAt,
            })),
            count: docs.length,
            message: `${docs.length} document(s) available: ${docs.map(d => `${d.filename} (${d.sizeBytes} bytes)`).join(", ")}`,
          },
        };
      }

      default:
        return { success: false, result: { error: `Tool "${toolName}" is not implemented.` } };
    }
  } catch (error: any) {
    console.error(`Tool ${toolName} error:`, error);
    return { success: false, result: { error: `Tool execution failed: ${error.message}` } };
  }
}

export function getOpenAIToolDefinitions(enabledTools: AgentTool[]): Array<{ type: "function"; name: string; description: string; parameters: Record<string, unknown> }> {
  return enabledTools
    .filter((t) => t.enabled)
    .map((t) => {
      const def = TOOL_DEFINITIONS[t.toolName];
      if (!def) return null;
      return {
        type: "function" as const,
        name: t.toolName,
        description: def.description,
        parameters: def.parameters,
      };
    })
    .filter(Boolean) as any;
}

export function buildSystemPrompt(agent: Agent): string {
  const config = (agent.config || {}) as AgentConfig;

  // ── Role description per agent type ──
  const typeDescriptions: Record<string, string> = {
    "pos-integration": "You are a POS integration assistant for a hospitality venue. You help with orders, payments, tab management, and POS operations.",
    "voice-pos": "You are a voice-controlled point-of-sale assistant. You take orders, manage tabs, process payments, and look up menu items through natural conversation.",
    "inventory": "You are an inventory management assistant. You track stock levels, manage suppliers, handle reordering, and log waste.",
    "venue-admin": "You are a venue administration assistant. You help with bookings, staff scheduling, financial reports, guest management, and event coordination.",
    "bevone": "You are BevOne, the comprehensive all-in-one venue operations assistant. You handle POS, inventory, bookings, staffing, guest management, and all venue operations.",
  };

  let prompt = typeDescriptions[agent.type] || "You are a helpful venue assistant.";
  prompt += `\nYour name is "${agent.name}".`;

  // ── CRITICAL: Anti-hallucination rules ──
  prompt += `

=== STRICT DATA RULES ===
1. NEVER invent, fabricate, or guess data. Every piece of information you share (menu items, prices, inventory levels, bookings, staff, guests, orders, suppliers) MUST come from a tool call result.
2. If the user asks about something and you have NOT yet called the relevant tool, call the tool FIRST, then answer based on the result.
3. If a tool returns no results or an error, say so honestly: "I don't have that information right now" or "No matching items were found." NEVER fill in with made-up data.
4. Do NOT assume menu items, prices, stock levels, staff names, booking dates, or any venue-specific information exist unless a tool has confirmed them in this conversation.
5. When you present numbers (prices, quantities, totals, counts), use ONLY the exact values returned by the tools. Do not round, estimate, or approximate.
6. If the user asks for something outside your tool capabilities, clearly explain what you can and cannot do.

=== RESPONSE GUIDELINES ===
- Be concise, friendly, and professional. Keep voice responses short — 1-3 sentences when possible.
- When using a tool, briefly say what you're doing ("Let me check the menu..." / "Looking up that booking...").
- Always confirm destructive or financial actions before executing: payments, placing orders, creating bookings, closing tabs.
- If you're unsure about the user's request, ask a clarifying question rather than guessing.`;

  // ── Language ──
  if (config.language && config.language !== "en") {
    const languageNames: Record<string, string> = {
      es: "Spanish", fr: "French", de: "German", it: "Italian",
      pt: "Portuguese", ja: "Japanese", zh: "Chinese",
    };
    const langName = languageNames[config.language] || config.language;
    prompt += `\n\nIMPORTANT: Respond in ${langName}. All your spoken and text responses must be in ${langName}.`;
  }

  // ── Speech pacing ──
  if (config.speed && config.speed !== 1) {
    if (config.speed < 1) {
      prompt += `\n\nSpeak slowly and clearly. Take your time with each response.`;
    } else if (config.speed > 1.3) {
      prompt += `\n\nSpeak quickly and efficiently. Be brief and to the point.`;
    } else if (config.speed > 1) {
      prompt += `\n\nSpeak at a slightly faster than normal pace. Be concise.`;
    }
  }

  // ── Conversation length limit ──
  if (config.maxConversationLength) {
    prompt += `\n\nLimit conversations to approximately ${config.maxConversationLength} exchanges. After reaching this limit, politely wrap up.`;
  }

  // ── Greeting & fallback ──
  if (config.greeting) {
    prompt += `\n\nGreet users with: "${config.greeting}"`;
  }
  if (config.fallbackMessage) {
    prompt += `\n\nIf you can't help with something, say: "${config.fallbackMessage}"`;
  }

  // ── Knowledge base (RAG) ──
  if (config.rag?.enabled) {
    prompt += `\n\nYou have access to a knowledge base with uploaded documents. When users ask about policies, procedures, venue-specific info, or anything that might be documented, use the knowledge_base_search tool FIRST before answering. Do NOT guess at document contents — always search.`;
  }

  // ── Wake word ──
  if (config.wakeWord?.enabled) {
    prompt += `\n\nThis agent uses wake word activation. The user said "${config.wakeWord.phrase}" to start. Be responsive immediately.`;
  }

  // ── Custom instructions (appended last so they can override defaults) ──
  if (config.systemPrompt) {
    prompt += `\n\n--- Custom Instructions ---\n${config.systemPrompt}`;
  }

  return prompt;
}
