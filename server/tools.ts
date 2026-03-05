import type { Agent, AgentTool, AgentConfig } from "@shared/schema";

export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  success: boolean;
  result: unknown;
}

const TOOL_DEFINITIONS: Record<string, { description: string; parameters: Record<string, unknown> }> = {
  square_pos_sync: {
    description: "Sync orders and payments with Square POS. Returns current sync status and recent transactions.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["sync", "status", "recent_orders"], description: "The sync action to perform" } }, required: ["action"] },
  },
  toast_pos_sync: {
    description: "Sync orders and payments with Toast POS. Returns current sync status and recent transactions.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["sync", "status", "recent_orders"], description: "The sync action to perform" } }, required: ["action"] },
  },
  payment_processing: {
    description: "Process a payment. Supports credit card and digital payment methods.",
    parameters: { type: "object", properties: { amount: { type: "number", description: "Payment amount in dollars" }, method: { type: "string", enum: ["credit_card", "apple_pay", "google_pay", "cash"], description: "Payment method" }, description: { type: "string", description: "Payment description" } }, required: ["amount", "method"] },
  },
  receipt_generation: {
    description: "Generate a digital receipt for a completed order.",
    parameters: { type: "object", properties: { orderId: { type: "string", description: "Order ID to generate receipt for" }, sendEmail: { type: "boolean", description: "Whether to email the receipt" } }, required: ["orderId"] },
  },
  tab_management: {
    description: "Open, view, or close a customer tab.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["open", "view", "close", "add_item"], description: "Tab action" }, tabId: { type: "string", description: "Tab identifier or customer name" }, item: { type: "string", description: "Item to add (for add_item action)" }, quantity: { type: "number", description: "Quantity" } }, required: ["action"] },
  },
  menu_lookup: {
    description: "Look up menu items, prices, and availability.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Search query for menu items" }, category: { type: "string", description: "Category filter (drinks, food, specials)" } }, required: ["query"] },
  },
  voice_ordering: {
    description: "Place an order using voice command. Parses natural language into structured order.",
    parameters: { type: "object", properties: { orderText: { type: "string", description: "Natural language order description" }, tableNumber: { type: "number", description: "Table number" } }, required: ["orderText"] },
  },
  split_checks: {
    description: "Split a check between multiple guests.",
    parameters: { type: "object", properties: { tabId: { type: "string", description: "Tab to split" }, splitCount: { type: "number", description: "Number of ways to split" }, splitType: { type: "string", enum: ["even", "by_item"], description: "How to split" } }, required: ["tabId", "splitCount"] },
  },
  customer_lookup: {
    description: "Look up customer profiles, preferences, and order history.",
    parameters: { type: "object", properties: { query: { type: "string", description: "Customer name, email, or phone" } }, required: ["query"] },
  },
  stock_tracking: {
    description: "Check current stock levels for items.",
    parameters: { type: "object", properties: { item: { type: "string", description: "Item name to check" }, category: { type: "string", description: "Category filter" } }, required: [] },
  },
  low_stock_alerts: {
    description: "Get items that are below their reorder threshold.",
    parameters: { type: "object", properties: { threshold: { type: "number", description: "Custom threshold override" } }, required: [] },
  },
  supplier_management: {
    description: "Manage supplier information and place restock orders.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["list", "contact", "order"], description: "Supplier action" }, supplierId: { type: "string", description: "Supplier identifier" }, items: { type: "string", description: "Items to reorder" } }, required: ["action"] },
  },
  waste_tracking: {
    description: "Log waste and spillage for cost tracking and analysis.",
    parameters: { type: "object", properties: { item: { type: "string", description: "Item wasted" }, quantity: { type: "number", description: "Quantity wasted" }, reason: { type: "string", enum: ["spill", "expired", "damaged", "other"], description: "Reason for waste" } }, required: ["item", "quantity", "reason"] },
  },
  auto_reorder: {
    description: "Automatically reorder items that hit reorder thresholds.",
    parameters: { type: "object", properties: { confirm: { type: "boolean", description: "Confirm the reorder" }, items: { type: "string", description: "Specific items to reorder, or 'all' for threshold-based" } }, required: [] },
  },
  inventory_pos_sync: {
    description: "Sync inventory counts with Square or Toast POS system.",
    parameters: { type: "object", properties: { posSystem: { type: "string", enum: ["square", "toast"], description: "Which POS to sync with" }, direction: { type: "string", enum: ["pull", "push", "both"], description: "Sync direction" } }, required: ["posSystem"] },
  },
  calendar_booking: {
    description: "View, create, or manage venue calendar events and bookings.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["view", "create", "cancel", "available_dates"], description: "Calendar action" }, date: { type: "string", description: "Date in YYYY-MM-DD format" }, eventType: { type: "string", description: "Type of event (wedding, corporate, private)" }, guestCount: { type: "number", description: "Expected guest count" } }, required: ["action"] },
  },
  staff_scheduling: {
    description: "View and manage staff schedules and shifts.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["view", "assign", "swap", "availability"], description: "Scheduling action" }, date: { type: "string", description: "Date to manage" }, staffId: { type: "string", description: "Staff member" } }, required: ["action"] },
  },
  financial_reports: {
    description: "Generate financial reports and revenue summaries.",
    parameters: { type: "object", properties: { reportType: { type: "string", enum: ["daily", "weekly", "monthly", "custom"], description: "Report period" }, startDate: { type: "string", description: "Start date" }, endDate: { type: "string", description: "End date" } }, required: ["reportType"] },
  },
  guest_management: {
    description: "Manage guest lists, RSVPs, and seating arrangements.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["view_list", "add_guest", "update_rsvp", "seating"], description: "Guest action" }, eventId: { type: "string", description: "Event identifier" }, guestName: { type: "string", description: "Guest name" } }, required: ["action"] },
  },
  vendor_coordination: {
    description: "Coordinate with event vendors (caterers, florists, DJs, etc.).",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["list", "contact", "schedule", "confirm"], description: "Vendor action" }, vendorType: { type: "string", description: "Type of vendor" }, eventId: { type: "string", description: "Event identifier" } }, required: ["action"] },
  },
  task_assignments: {
    description: "Create, assign, and track staff tasks.",
    parameters: { type: "object", properties: { action: { type: "string", enum: ["list", "create", "assign", "complete", "status"], description: "Task action" }, taskDescription: { type: "string", description: "Task description" }, assignee: { type: "string", description: "Person to assign to" }, priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Task priority" } }, required: ["action"] },
  },
};

const MOCK_MENU: Record<string, { price: number; available: boolean; category: string }> = {
  "margarita": { price: 12, available: true, category: "cocktails" },
  "old fashioned": { price: 14, available: true, category: "cocktails" },
  "moscow mule": { price: 13, available: true, category: "cocktails" },
  "mojito": { price: 12, available: true, category: "cocktails" },
  "espresso martini": { price: 15, available: true, category: "cocktails" },
  "bud light": { price: 6, available: true, category: "beer" },
  "ipa": { price: 8, available: true, category: "beer" },
  "chardonnay": { price: 11, available: true, category: "wine" },
  "cabernet": { price: 13, available: true, category: "wine" },
  "prosecco": { price: 10, available: true, category: "wine" },
  "titos vodka": { price: 10, available: true, category: "spirits" },
  "jack daniels": { price: 10, available: true, category: "spirits" },
  "hendricks gin": { price: 12, available: true, category: "spirits" },
  "patron silver": { price: 14, available: true, category: "spirits" },
  "nachos": { price: 12, available: true, category: "food" },
  "wings": { price: 14, available: true, category: "food" },
  "sliders": { price: 16, available: true, category: "food" },
  "fries": { price: 8, available: true, category: "food" },
};

const MOCK_INVENTORY: Record<string, { quantity: number; unit: string; reorderThreshold: number }> = {
  "titos vodka": { quantity: 12, unit: "bottles", reorderThreshold: 5 },
  "jack daniels": { quantity: 8, unit: "bottles", reorderThreshold: 5 },
  "hendricks gin": { quantity: 3, unit: "bottles", reorderThreshold: 4 },
  "patron silver": { quantity: 6, unit: "bottles", reorderThreshold: 3 },
  "bud light": { quantity: 48, unit: "cans", reorderThreshold: 24 },
  "prosecco": { quantity: 15, unit: "bottles", reorderThreshold: 6 },
  "limes": { quantity: 25, unit: "pieces", reorderThreshold: 10 },
  "lemons": { quantity: 18, unit: "pieces", reorderThreshold: 10 },
  "simple syrup": { quantity: 4, unit: "bottles", reorderThreshold: 2 },
  "ice": { quantity: 200, unit: "lbs", reorderThreshold: 50 },
};

export function executeToolCall(toolName: string, args: Record<string, unknown>): ToolCallResult {
  switch (toolName) {
    case "menu_lookup": {
      const query = (args.query as string || "").toLowerCase();
      const category = (args.category as string || "").toLowerCase();
      const matches = Object.entries(MOCK_MENU)
        .filter(([name, info]) => {
          const nameMatch = !query || name.includes(query);
          const catMatch = !category || info.category === category;
          return nameMatch && catMatch;
        })
        .map(([name, info]) => ({ name, ...info }));
      return { success: true, result: { items: matches, total: matches.length } };
    }
    case "stock_tracking": {
      const item = (args.item as string || "").toLowerCase();
      if (item) {
        const found = MOCK_INVENTORY[item];
        if (found) return { success: true, result: { item, ...found, status: found.quantity <= found.reorderThreshold ? "low" : "in_stock" } };
        return { success: true, result: { item, message: "Item not found in inventory" } };
      }
      return { success: true, result: Object.entries(MOCK_INVENTORY).map(([name, info]) => ({ name, ...info, status: info.quantity <= info.reorderThreshold ? "low" : "in_stock" })) };
    }
    case "low_stock_alerts": {
      const lowItems = Object.entries(MOCK_INVENTORY)
        .filter(([, info]) => info.quantity <= info.reorderThreshold)
        .map(([name, info]) => ({ name, ...info }));
      return { success: true, result: { alerts: lowItems, count: lowItems.length } };
    }
    case "tab_management": {
      const action = args.action as string;
      if (action === "open") return { success: true, result: { tabId: `TAB-${Date.now().toString(36).toUpperCase()}`, customer: args.tabId || "Guest", status: "open", items: [], total: 0 } };
      if (action === "add_item") {
        const itemName = (args.item as string || "").toLowerCase();
        const menuItem = MOCK_MENU[itemName];
        const qty = (args.quantity as number) || 1;
        if (menuItem) return { success: true, result: { tabId: args.tabId, added: itemName, quantity: qty, lineTotal: menuItem.price * qty, message: `Added ${qty}x ${itemName} ($${menuItem.price * qty})` } };
        return { success: false, result: { error: `Item "${args.item}" not found on menu` } };
      }
      if (action === "close") return { success: true, result: { tabId: args.tabId, status: "closed", total: 47.50, message: "Tab closed. Total: $47.50" } };
      return { success: true, result: { tabId: args.tabId || "TAB-001", status: "open", items: [{ name: "Margarita", qty: 2, price: 24 }, { name: "Nachos", qty: 1, price: 12 }], total: 36 } };
    }
    case "voice_ordering": {
      return { success: true, result: { orderId: `ORD-${Date.now().toString(36).toUpperCase()}`, items: [{ name: "Parsed from voice", quantity: 1 }], table: args.tableNumber || "bar", status: "confirmed", message: `Order placed for table ${args.tableNumber || "bar"}` } };
    }
    case "payment_processing": {
      return { success: true, result: { transactionId: `TXN-${Date.now().toString(36).toUpperCase()}`, amount: args.amount, method: args.method, status: "approved", message: `Payment of $${args.amount} processed via ${args.method}` } };
    }
    case "split_checks": {
      const total = 47.50;
      const count = (args.splitCount as number) || 2;
      return { success: true, result: { tabId: args.tabId, splitCount: count, amountPerPerson: (total / count).toFixed(2), total, message: `Check split ${count} ways: $${(total / count).toFixed(2)} each` } };
    }
    case "calendar_booking": {
      const action = args.action as string;
      if (action === "available_dates") return { success: true, result: { availableDates: ["2026-03-14", "2026-03-21", "2026-03-28", "2026-04-04", "2026-04-11"], message: "5 available dates found in the next 6 weeks" } };
      if (action === "create") return { success: true, result: { bookingId: `BK-${Date.now().toString(36).toUpperCase()}`, date: args.date, type: args.eventType, guests: args.guestCount, status: "confirmed" } };
      return { success: true, result: { events: [{ date: "2026-03-14", type: "Wedding Reception", guests: 150, status: "confirmed" }, { date: "2026-03-21", type: "Corporate Event", guests: 80, status: "pending" }] } };
    }
    case "staff_scheduling": {
      return { success: true, result: { date: args.date || "today", shifts: [{ staff: "Alex", role: "Bartender", time: "4PM-12AM" }, { staff: "Jordan", role: "Server", time: "5PM-11PM" }, { staff: "Sam", role: "Host", time: "5PM-10PM" }] } };
    }
    case "financial_reports": {
      return { success: true, result: { period: args.reportType, revenue: 12450, costs: 4200, profit: 8250, topItems: ["Margarita", "Old Fashioned", "Wings"], transactions: 342 } };
    }
    case "guest_management": {
      return { success: true, result: { totalGuests: 150, confirmed: 120, pending: 25, declined: 5, message: "Guest list updated" } };
    }
    case "customer_lookup": {
      return { success: true, result: { name: args.query, visits: 12, lastVisit: "2026-02-28", favoriteItems: ["Old Fashioned", "Wings"], totalSpent: 486.50, vipStatus: true } };
    }
    default:
      return { success: true, result: { message: `Tool ${toolName} executed successfully`, args } };
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
  const typeDescriptions: Record<string, string> = {
    "pos-integration": "You are a POS integration assistant for a venue. Help with orders, payments, and POS system management.",
    "voice-pos": "You are a voice-controlled point of sale system. Take orders, process payments, and manage tabs through natural conversation.",
    "inventory": "You are an inventory management assistant. Track stock levels, manage suppliers, and handle reordering.",
    "venue-admin": "You are a venue administration assistant. Help with bookings, staff scheduling, financial reports, and event management.",
    "bevone": "You are BevOne, the comprehensive all-in-one venue assistant. You handle POS operations, inventory, bookings, staffing, and everything a venue needs.",
  };

  let prompt = typeDescriptions[agent.type] || "You are a helpful venue assistant.";
  prompt += `\n\nYour name is "${agent.name}".`;
  prompt += "\nYou work at a beverage and event venue.";
  prompt += "\nBe concise, friendly, and professional. When using tools, explain what you're doing.";
  prompt += "\nIf a guest asks about menu items, use the menu_lookup tool. For inventory questions, use stock_tracking.";
  prompt += "\nAlways confirm actions before processing payments or making bookings.";

  if (config.greeting) {
    prompt += `\n\nGreet users with: "${config.greeting}"`;
  }
  if (config.fallbackMessage) {
    prompt += `\n\nIf you can't help with something, say: "${config.fallbackMessage}"`;
  }

  return prompt;
}
