import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Edit2, X, Check, Package, UtensilsCrossed, Users, Calendar, Star, Truck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "menu" | "inventory" | "staff" | "bookings" | "guests" | "suppliers";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "menu", label: "Menu", icon: UtensilsCrossed },
  { key: "inventory", label: "Inventory", icon: Package },
  { key: "staff", label: "Staff", icon: Users },
  { key: "bookings", label: "Bookings", icon: Calendar },
  { key: "guests", label: "Guests", icon: Star },
  { key: "suppliers", label: "Suppliers", icon: Truck },
];

function AddForm({ fields, onSubmit, onCancel }: {
  fields: { name: string; label: string; type?: string; options?: string[]; required?: boolean }[];
  onSubmit: (data: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border border-gray-200 rounded-xl p-4 mb-4 bg-white">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="text-xs font-medium text-gray-500 mb-1 block">{f.label}</label>
            {f.options ? (
              <select data-testid={`select-${f.name}`} value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select...</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input data-testid={`input-${f.name}`} type={f.type || "text"} placeholder={f.label} value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <button data-testid="button-save-item" onClick={() => onSubmit(values)} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-1.5"><Check size={14} /> Save</button>
        <button data-testid="button-cancel-add" onClick={onCancel} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-1.5"><X size={14} /> Cancel</button>
      </div>
    </motion.div>
  );
}

function DataTable({ columns, data, onDelete, idKey = "id" }: {
  columns: { key: string; label: string; render?: (v: any, row: any) => any }[];
  data: any[];
  onDelete?: (id: number) => void;
  idKey?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" data-testid="data-table">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map((c) => <th key={c.key} className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">{c.label}</th>)}
            {onDelete && <th className="w-10"></th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row[idKey]} className="border-b border-gray-100 hover:bg-gray-50 transition-colors" data-testid={`row-${row[idKey]}`}>
              {columns.map((c) => (
                <td key={c.key} className="py-3 px-4 text-sm text-gray-700">
                  {c.render ? c.render(row[c.key], row) : row[c.key] ?? "—"}
                </td>
              ))}
              {onDelete && (
                <td className="py-3 px-2">
                  <button data-testid={`button-delete-${row[idKey]}`} onClick={() => onDelete(row[idKey])} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={columns.length + 1} className="py-12 text-center text-sm text-gray-400">No data yet. Click "Add" to create your first entry.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MenuTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: items = [] } = useQuery({ queryKey: ["venue", "menu"], queryFn: async () => { const r = await fetch("/api/venue/menu", { credentials: "include" }); return r.json(); } });
  const create = useMutation({ mutationFn: async (d: any) => { await apiRequest("POST", "/api/venue/menu", d); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["venue", "menu"] }); setAdding(false); } });
  const del = useMutation({ mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/venue/menu/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", "menu"] }) });
  const toggle = useMutation({ mutationFn: async ({ id, available }: { id: number; available: boolean }) => { await apiRequest("PATCH", `/api/venue/menu/${id}`, { available }); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", "menu"] }) });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{items.length} items on the menu</p>
        <button data-testid="button-add-menu" onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"><Plus size={14} /> Add Item</button>
      </div>
      <AnimatePresence>
        {adding && <AddForm fields={[
          { name: "name", label: "Name", required: true },
          { name: "price", label: "Price ($)", type: "number", required: true },
          { name: "category", label: "Category", options: ["cocktails", "beer", "wine", "spirits", "food", "non-alcoholic"] },
          { name: "description", label: "Description" },
        ]} onSubmit={(d) => create.mutate({ name: d.name, price: d.price, category: d.category || "food", description: d.description })} onCancel={() => setAdding(false)} />}
      </AnimatePresence>
      <DataTable
        columns={[
          { key: "name", label: "Name" },
          { key: "price", label: "Price", render: (v: string) => `$${parseFloat(v).toFixed(2)}` },
          { key: "category", label: "Category", render: (v: string) => <span className="inline-block px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium capitalize">{v}</span> },
          { key: "description", label: "Description" },
          { key: "available", label: "Available", render: (v: boolean, row: any) => (
            <button data-testid={`toggle-avail-${row.id}`} onClick={() => toggle.mutate({ id: row.id, available: !v })} className={`w-8 h-5 rounded-full transition-colors relative ${v ? "bg-green-500" : "bg-gray-300"}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${v ? "left-3.5" : "left-0.5"}`} />
            </button>
          )},
        ]}
        data={items}
        onDelete={(id) => del.mutate(id)}
      />
    </div>
  );
}

function InventoryTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: items = [] } = useQuery({ queryKey: ["venue", "inventory"], queryFn: async () => { const r = await fetch("/api/venue/inventory", { credentials: "include" }); return r.json(); } });
  const create = useMutation({ mutationFn: async (d: any) => { await apiRequest("POST", "/api/venue/inventory", d); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["venue", "inventory"] }); setAdding(false); } });
  const del = useMutation({ mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/venue/inventory/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", "inventory"] }) });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{items.length} inventory items</p>
        <button data-testid="button-add-inventory" onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"><Plus size={14} /> Add Item</button>
      </div>
      <AnimatePresence>
        {adding && <AddForm fields={[
          { name: "name", label: "Name", required: true },
          { name: "quantity", label: "Quantity", type: "number", required: true },
          { name: "unit", label: "Unit (bottles, cans, etc.)", required: true },
          { name: "cost", label: "Cost per unit ($)", type: "number" },
          { name: "reorderThreshold", label: "Reorder Threshold", type: "number" },
          { name: "supplier", label: "Supplier" },
        ]} onSubmit={(d) => create.mutate({ name: d.name, quantity: d.quantity, unit: d.unit || "units", cost: d.cost, reorderThreshold: d.reorderThreshold || "0", supplier: d.supplier })} onCancel={() => setAdding(false)} />}
      </AnimatePresence>
      <DataTable
        columns={[
          { key: "name", label: "Item" },
          { key: "quantity", label: "Qty", render: (v: string, row: any) => {
            const q = parseFloat(v); const t = parseFloat(row.reorderThreshold || "0");
            return <span className={q <= t ? "text-red-600 font-semibold" : ""}>{v} {row.unit}</span>;
          }},
          { key: "reorderThreshold", label: "Reorder At" },
          { key: "cost", label: "Cost/Unit", render: (v: string) => v ? `$${parseFloat(v).toFixed(2)}` : "—" },
          { key: "supplier", label: "Supplier" },
        ]}
        data={items}
        onDelete={(id) => del.mutate(id)}
      />
    </div>
  );
}

function StaffTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: staff = [] } = useQuery({ queryKey: ["venue", "staff"], queryFn: async () => { const r = await fetch("/api/venue/staff", { credentials: "include" }); return r.json(); } });
  const create = useMutation({ mutationFn: async (d: any) => { await apiRequest("POST", "/api/venue/staff", d); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["venue", "staff"] }); setAdding(false); } });
  const del = useMutation({ mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/venue/staff/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", "staff"] }) });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{staff.length} staff members</p>
        <button data-testid="button-add-staff" onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"><Plus size={14} /> Add Staff</button>
      </div>
      <AnimatePresence>
        {adding && <AddForm fields={[
          { name: "name", label: "Full Name", required: true },
          { name: "role", label: "Role", options: ["Head Bartender", "Bartender", "Server", "Host", "Manager", "Kitchen", "Barback"] },
          { name: "email", label: "Email" },
          { name: "phone", label: "Phone" },
        ]} onSubmit={(d) => create.mutate({ name: d.name, role: d.role || "Server", email: d.email, phone: d.phone })} onCancel={() => setAdding(false)} />}
      </AnimatePresence>
      <DataTable
        columns={[
          { key: "name", label: "Name" },
          { key: "role", label: "Role", render: (v: string) => <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">{v}</span> },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
        ]}
        data={staff}
        onDelete={(id) => del.mutate(id)}
      />
    </div>
  );
}

function BookingsTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: bookingsList = [] } = useQuery({ queryKey: ["venue", "bookings"], queryFn: async () => { const r = await fetch("/api/venue/bookings", { credentials: "include" }); return r.json(); } });
  const create = useMutation({ mutationFn: async (d: any) => { await apiRequest("POST", "/api/venue/bookings", d); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["venue", "bookings"] }); setAdding(false); } });
  const del = useMutation({ mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/venue/bookings/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", "bookings"] }) });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{bookingsList.length} bookings</p>
        <button data-testid="button-add-booking" onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"><Plus size={14} /> Add Booking</button>
      </div>
      <AnimatePresence>
        {adding && <AddForm fields={[
          { name: "guestName", label: "Guest Name", required: true },
          { name: "eventDate", label: "Event Date", type: "date", required: true },
          { name: "eventTime", label: "Time" },
          { name: "eventType", label: "Event Type", options: ["Wedding", "Corporate", "Private Party", "Birthday", "Anniversary", "Other"] },
          { name: "guestCount", label: "Guest Count", type: "number" },
          { name: "guestEmail", label: "Email" },
          { name: "guestPhone", label: "Phone" },
          { name: "notes", label: "Notes" },
        ]} onSubmit={(d) => create.mutate({ guestName: d.guestName, eventDate: d.eventDate, eventTime: d.eventTime, eventType: d.eventType || "Private Party", guestCount: parseInt(d.guestCount) || 1, guestEmail: d.guestEmail, guestPhone: d.guestPhone, notes: d.notes })} onCancel={() => setAdding(false)} />}
      </AnimatePresence>
      <DataTable
        columns={[
          { key: "eventDate", label: "Date" },
          { key: "eventType", label: "Type", render: (v: string) => <span className="inline-block px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md text-xs font-medium">{v}</span> },
          { key: "guestName", label: "Guest" },
          { key: "guestCount", label: "Count" },
          { key: "status", label: "Status", render: (v: string) => <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${v === "confirmed" ? "bg-green-50 text-green-700" : v === "cancelled" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>{v}</span> },
        ]}
        data={bookingsList}
        onDelete={(id) => del.mutate(id)}
      />
    </div>
  );
}

function GuestsTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: guestList = [] } = useQuery({ queryKey: ["venue", "guests"], queryFn: async () => { const r = await fetch("/api/venue/guests", { credentials: "include" }); return r.json(); } });
  const create = useMutation({ mutationFn: async (d: any) => { await apiRequest("POST", "/api/venue/guests", d); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["venue", "guests"] }); setAdding(false); } });
  const del = useMutation({ mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/venue/guests/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", "guests"] }) });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{guestList.length} guests, {guestList.filter((g: any) => g.vipStatus).length} VIP</p>
        <button data-testid="button-add-guest" onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"><Plus size={14} /> Add Guest</button>
      </div>
      <AnimatePresence>
        {adding && <AddForm fields={[
          { name: "name", label: "Full Name", required: true },
          { name: "email", label: "Email" },
          { name: "phone", label: "Phone" },
          { name: "notes", label: "Notes / Preferences" },
        ]} onSubmit={(d) => create.mutate({ name: d.name, email: d.email, phone: d.phone, notes: d.notes })} onCancel={() => setAdding(false)} />}
      </AnimatePresence>
      <DataTable
        columns={[
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "visitCount", label: "Visits" },
          { key: "totalSpent", label: "Total Spent", render: (v: string) => `$${parseFloat(v || "0").toFixed(2)}` },
          { key: "vipStatus", label: "VIP", render: (v: boolean) => v ? <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-xs font-bold">VIP</span> : "—" },
          { key: "notes", label: "Notes" },
        ]}
        data={guestList}
        onDelete={(id) => del.mutate(id)}
      />
    </div>
  );
}

function SuppliersTab() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: supplierList = [] } = useQuery({ queryKey: ["venue", "suppliers"], queryFn: async () => { const r = await fetch("/api/venue/suppliers", { credentials: "include" }); return r.json(); } });
  const create = useMutation({ mutationFn: async (d: any) => { await apiRequest("POST", "/api/venue/suppliers", d); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["venue", "suppliers"] }); setAdding(false); } });
  const del = useMutation({ mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/venue/suppliers/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["venue", "suppliers"] }) });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{supplierList.length} suppliers</p>
        <button data-testid="button-add-supplier" onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"><Plus size={14} /> Add Supplier</button>
      </div>
      <AnimatePresence>
        {adding && <AddForm fields={[
          { name: "name", label: "Company Name", required: true },
          { name: "contactName", label: "Contact Person" },
          { name: "email", label: "Email" },
          { name: "phone", label: "Phone" },
          { name: "items", label: "Products Supplied" },
        ]} onSubmit={(d) => create.mutate({ name: d.name, contactName: d.contactName, email: d.email, phone: d.phone, items: d.items })} onCancel={() => setAdding(false)} />}
      </AnimatePresence>
      <DataTable
        columns={[
          { key: "name", label: "Company" },
          { key: "contactName", label: "Contact" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "items", label: "Products" },
        ]}
        data={supplierList}
        onDelete={(id) => del.mutate(id)}
      />
    </div>
  );
}

export default function VenueData() {
  const [activeTab, setActiveTab] = useState<Tab>("menu");

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-10 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-venue-title">Venue Data</h1>
          <p className="text-sm text-gray-500 mt-1">Manage the data your voice agents use — menus, inventory, staff, bookings, and guests.</p>
        </div>

        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl overflow-x-auto" data-testid="venue-tabs">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              data-testid={`tab-${key}`}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4">
            {activeTab === "menu" && <MenuTab />}
            {activeTab === "inventory" && <InventoryTab />}
            {activeTab === "staff" && <StaffTab />}
            {activeTab === "bookings" && <BookingsTab />}
            {activeTab === "guests" && <GuestsTab />}
            {activeTab === "suppliers" && <SuppliersTab />}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
