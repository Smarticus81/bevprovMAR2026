export interface ToolDefinition {
  name: string;
  category: string;
  description: string;
  agentTypes: string[];
}

const ALL_TYPES = ["pos-integration", "voice-pos", "inventory", "venue-admin", "bevone"];

export const TOOL_CATALOG: ToolDefinition[] = [
  { name: "square_pos_sync", category: "POS", description: "Sync orders and payments with Square POS", agentTypes: ALL_TYPES },
  { name: "toast_pos_sync", category: "POS", description: "Sync orders and payments with Toast POS", agentTypes: ALL_TYPES },
  { name: "payment_processing", category: "POS", description: "Process credit card and digital payments", agentTypes: ALL_TYPES },
  { name: "receipt_generation", category: "POS", description: "Generate and send digital receipts", agentTypes: ALL_TYPES },
  { name: "tab_management", category: "POS", description: "Open, manage, and close customer tabs", agentTypes: ALL_TYPES },
  { name: "menu_lookup", category: "POS", description: "Look up menu items, prices, and availability", agentTypes: ALL_TYPES },
  { name: "voice_ordering", category: "Voice POS", description: "Take orders through voice commands", agentTypes: ALL_TYPES },
  { name: "split_checks", category: "Voice POS", description: "Split checks between multiple guests", agentTypes: ALL_TYPES },
  { name: "customer_lookup", category: "Voice POS", description: "Look up customer profiles and preferences", agentTypes: ALL_TYPES },
  { name: "stock_tracking", category: "Inventory", description: "Track real-time stock levels across items", agentTypes: ALL_TYPES },
  { name: "low_stock_alerts", category: "Inventory", description: "Get notified when items are running low", agentTypes: ALL_TYPES },
  { name: "supplier_management", category: "Inventory", description: "Manage supplier contacts and orders", agentTypes: ALL_TYPES },
  { name: "waste_tracking", category: "Inventory", description: "Track waste and spillage for cost analysis", agentTypes: ALL_TYPES },
  { name: "auto_reorder", category: "Inventory", description: "Automatically reorder items at threshold", agentTypes: ALL_TYPES },
  { name: "inventory_pos_sync", category: "Inventory", description: "Sync inventory with Square/Toast POS", agentTypes: ALL_TYPES },
  { name: "calendar_booking", category: "Operations", description: "Manage venue calendar and event bookings", agentTypes: ALL_TYPES },
  { name: "staff_scheduling", category: "Operations", description: "Create and manage staff schedules", agentTypes: ALL_TYPES },
  { name: "financial_reports", category: "Operations", description: "Generate financial reports and summaries", agentTypes: ALL_TYPES },
  { name: "guest_management", category: "Operations", description: "Manage guest lists and RSVPs", agentTypes: ALL_TYPES },
  { name: "vendor_coordination", category: "Operations", description: "Coordinate with vendors and suppliers", agentTypes: ALL_TYPES },
  { name: "task_assignments", category: "Operations", description: "Assign and track staff tasks", agentTypes: ALL_TYPES },
  { name: "knowledge_base_search", category: "Knowledge", description: "Search uploaded documents and knowledge base", agentTypes: ALL_TYPES },
  { name: "read_document", category: "Knowledge", description: "Read the full content of an uploaded document by ID or filename", agentTypes: ALL_TYPES },
  { name: "list_documents", category: "Knowledge", description: "List all available uploaded documents", agentTypes: ALL_TYPES },
];

export function getToolsForAgentType(agentType: string): ToolDefinition[] {
  return TOOL_CATALOG.filter((tool) => tool.agentTypes.includes(agentType));
}
