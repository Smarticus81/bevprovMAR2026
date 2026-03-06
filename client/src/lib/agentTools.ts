export interface ToolDefinition {
  name: string;
  category: string;
  description: string;
  agentTypes: string[];
}

export const TOOL_CATALOG: ToolDefinition[] = [
  { name: "square_pos_sync", category: "POS", description: "Sync orders and payments with Square POS", agentTypes: ["pos-integration", "voice-pos", "bevone"] },
  { name: "toast_pos_sync", category: "POS", description: "Sync orders and payments with Toast POS", agentTypes: ["pos-integration", "voice-pos", "bevone"] },
  { name: "payment_processing", category: "POS", description: "Process credit card and digital payments", agentTypes: ["pos-integration", "voice-pos", "bevone"] },
  { name: "receipt_generation", category: "POS", description: "Generate and send digital receipts", agentTypes: ["pos-integration", "voice-pos", "bevone"] },
  { name: "tab_management", category: "POS", description: "Open, manage, and close customer tabs", agentTypes: ["pos-integration", "voice-pos", "bevone"] },
  { name: "menu_lookup", category: "POS", description: "Look up menu items, prices, and availability", agentTypes: ["pos-integration", "voice-pos", "bevone"] },
  { name: "voice_ordering", category: "Voice POS", description: "Take orders through voice commands", agentTypes: ["voice-pos", "bevone"] },
  { name: "split_checks", category: "Voice POS", description: "Split checks between multiple guests", agentTypes: ["voice-pos", "bevone"] },
  { name: "customer_lookup", category: "Voice POS", description: "Look up customer profiles and preferences", agentTypes: ["voice-pos", "bevone"] },
  { name: "stock_tracking", category: "Inventory", description: "Track real-time stock levels across items", agentTypes: ["inventory", "bevone"] },
  { name: "low_stock_alerts", category: "Inventory", description: "Get notified when items are running low", agentTypes: ["inventory", "bevone"] },
  { name: "supplier_management", category: "Inventory", description: "Manage supplier contacts and orders", agentTypes: ["inventory", "bevone"] },
  { name: "waste_tracking", category: "Inventory", description: "Track waste and spillage for cost analysis", agentTypes: ["inventory", "bevone"] },
  { name: "auto_reorder", category: "Inventory", description: "Automatically reorder items at threshold", agentTypes: ["inventory", "bevone"] },
  { name: "inventory_pos_sync", category: "Inventory", description: "Sync inventory with Square/Toast POS", agentTypes: ["inventory", "bevone"] },
  { name: "calendar_booking", category: "Operations", description: "Manage venue calendar and event bookings", agentTypes: ["venue-admin", "bevone"] },
  { name: "staff_scheduling", category: "Operations", description: "Create and manage staff schedules", agentTypes: ["venue-admin", "bevone"] },
  { name: "financial_reports", category: "Operations", description: "Generate financial reports and summaries", agentTypes: ["venue-admin", "bevone"] },
  { name: "guest_management", category: "Operations", description: "Manage guest lists and RSVPs", agentTypes: ["venue-admin", "bevone"] },
  { name: "vendor_coordination", category: "Operations", description: "Coordinate with vendors and suppliers", agentTypes: ["venue-admin", "bevone"] },
  { name: "task_assignments", category: "Operations", description: "Assign and track staff tasks", agentTypes: ["venue-admin", "bevone"] },
  { name: "knowledge_base_search", category: "Knowledge", description: "Search uploaded documents and knowledge base", agentTypes: ["pos-integration", "voice-pos", "inventory", "venue-admin", "bevone"] },
];

export function getToolsForAgentType(agentType: string): ToolDefinition[] {
  return TOOL_CATALOG.filter((tool) => tool.agentTypes.includes(agentType));
}
