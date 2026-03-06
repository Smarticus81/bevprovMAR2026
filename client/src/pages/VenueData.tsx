import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, X, Check, Package, UtensilsCrossed, Users, Calendar, Star, Truck, Upload, FileText, Database, AlertCircle, Loader2 } from "lucide-react";
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
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border-b border-white/[0.06] pb-6 mb-6 overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
        {fields.map((f) => (
          <div key={f.name}>
            <label className="text-xs uppercase tracking-[0.15em] text-white/40 font-medium block mb-2">{f.label}</label>
            {f.options ? (
              <select data-testid={`select-${f.name}`} value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className="w-full bg-transparent border-0 border-b border-white/10 px-0 py-3 text-base text-white focus:outline-none focus:border-[#C9A96E]/40 transition-colors appearance-none">
                <option value="" className="bg-black">Select...</option>
                {f.options.map((o) => <option key={o} value={o} className="bg-black">{o}</option>)}
              </select>
            ) : (
              <input data-testid={`input-${f.name}`} type={f.type || "text"} placeholder={f.label} value={values[f.name] || ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className="w-full bg-transparent border-0 border-b border-white/10 px-0 py-3 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-[#C9A96E]/40 transition-colors" />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-6">
        <button data-testid="button-save-item" onClick={() => onSubmit(values)} className="flex items-center gap-2 bg-[#C9A96E] text-black px-5 py-3 text-sm font-semibold hover:bg-[#D4B87A] transition-colors rounded"><Check size={16} /> Save</button>
        <button data-testid="button-cancel-add" onClick={onCancel} className="flex items-center gap-2 text-white/40 hover:text-white/60 text-sm px-4 py-3 transition-colors"><X size={16} /> Cancel</button>
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
  if (data.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-white/30" data-testid="data-table">
        No data yet. Click "Add" to create your first entry.
      </div>
    );
  }

  return (
    <div data-testid="data-table">
      <div className="hidden sm:block overflow-x-auto -mx-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {columns.map((c) => <th key={c.key} className="text-left text-xs font-medium text-white/40 uppercase tracking-[0.12em] py-3.5 px-3">{c.label}</th>)}
              {onDelete && <th className="w-12"></th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row[idKey]} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group" data-testid={`row-${row[idKey]}`}>
                {columns.map((c) => (
                  <td key={c.key} className="py-3.5 px-3 text-sm text-white/70">
                    {c.render ? c.render(row[c.key], row) : row[c.key] ?? "—"}
                  </td>
                ))}
                {onDelete && (
                  <td className="py-3.5 px-2">
                    <button data-testid={`button-delete-${row[idKey]}`} onClick={() => onDelete(row[idKey])} className="p-2 text-white/20 hover:text-red-400/70 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-3">
        {data.map((row) => (
          <div key={row[idKey]} data-testid={`row-${row[idKey]}`} className="border border-white/[0.08] bg-white/[0.02] rounded p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-base font-medium text-white truncate">
                  {row[columns[0].key] ?? "—"}
                </p>
                {columns[1] && (
                  <p className="text-sm text-white/50 mt-1">
                    {columns[1].render ? columns[1].render(row[columns[1].key], row) : row[columns[1].key] ?? "—"}
                  </p>
                )}
              </div>
              {onDelete && (
                <button data-testid={`button-delete-${row[idKey]}`} onClick={() => onDelete(row[idKey])} className="p-2 text-white/30 hover:text-red-400/70 transition-colors shrink-0">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {columns.slice(2).map((c) => {
              const val = c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—");
              return (
                <div key={c.key} className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                  <span className="text-xs uppercase tracking-[0.12em] text-white/35 font-medium">{c.label}</span>
                  <span className="text-sm text-white/60">{val}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function BulkImportSection() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"closed" | "paste" | "file">("closed");
  const [jsonText, setJsonText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkImport = useMutation({
    mutationFn: async (items: any[]) => {
      const res = await apiRequest("POST", "/api/venue/menu/bulk", { items });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["venue", "menu"] });
      setImportSuccess(`Imported ${data.imported} items`);
      setJsonText("");
      setMode("closed");
      setTimeout(() => setImportSuccess(null), 4000);
    },
    onError: (err: Error) => {
      setImportError(err.message || "Import failed");
    },
  });

  const parseAndImport = (text: string) => {
    setImportError(null);
    try {
      let items: any[];
      const trimmed = text.trim();
      if (trimmed.startsWith("[")) {
        items = JSON.parse(trimmed);
      } else if (trimmed.startsWith("{")) {
        const obj = JSON.parse(trimmed);
        items = obj.items || obj.menu || obj.drinks || [obj];
      } else {
        const lines = trimmed.split("\n").filter(l => l.trim());
        if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        const nameIdx = headers.findIndex(h => h === "name" || h === "item" || h === "drink");
        const priceIdx = headers.findIndex(h => h === "price" || h === "cost");
        const catIdx = headers.findIndex(h => h === "category" || h === "type");
        const descIdx = headers.findIndex(h => h === "description" || h === "desc");
        if (nameIdx === -1) throw new Error("CSV must have a 'name' column");
        items = lines.slice(1).map(line => {
          const cols = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
          return {
            name: cols[nameIdx],
            price: priceIdx >= 0 ? cols[priceIdx]?.replace("$", "") : "0",
            category: catIdx >= 0 ? cols[catIdx] : "food",
            description: descIdx >= 0 ? cols[descIdx] : "",
          };
        }).filter(i => i.name);
      }
      if (!Array.isArray(items) || items.length === 0) throw new Error("No valid items found");
      bulkImport.mutate(items);
    } catch (e: any) {
      setImportError(e.message || "Invalid format");
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseAndImport(text);
    };
    reader.readAsText(file);
  };

  if (mode === "closed") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {importSuccess && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-emerald-400">{importSuccess}</motion.span>
        )}
        <button
          data-testid="button-bulk-paste"
          onClick={() => setMode("paste")}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/50 text-sm py-2 px-3 transition-colors"
        >
          <FileText size={14} />
          Paste JSON/CSV
        </button>
        <button
          data-testid="button-bulk-file"
          onClick={() => { setMode("file"); fileInputRef.current?.click(); }}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/50 text-sm py-2 px-3 transition-colors"
        >
          <Upload size={14} />
          Upload File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,.txt"
          className="hidden"
          data-testid="input-bulk-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
            e.target.value = "";
            setMode("closed");
          }}
        />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="border-b border-white/[0.06] pb-6 mb-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-[0.12em] text-white/40 font-medium">Bulk Import</p>
        <button onClick={() => { setMode("closed"); setImportError(null); }} className="text-white/30 hover:text-white/50 text-sm py-1 px-2">Cancel</button>
      </div>
      <textarea
        data-testid="textarea-bulk-import"
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        placeholder={'Paste JSON or CSV here...\n\nJSON: [{"name": "Margarita", "price": "12", "category": "cocktails"}]\n\nCSV:\nname,price,category\nMargarita,12,cocktails\nOld Fashioned,14,cocktails'}
        rows={6}
        className="w-full bg-white/[0.02] border border-white/[0.06] rounded px-4 py-3 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-[#C9A96E]/30 transition-colors font-mono"
      />
      {importError && (
        <div className="flex items-center gap-2 mt-2 text-red-400/80 text-sm">
          <AlertCircle size={14} />
          {importError}
        </div>
      )}
      <div className="flex gap-3 mt-4">
        <button
          data-testid="button-import-submit"
          onClick={() => parseAndImport(jsonText)}
          disabled={!jsonText.trim() || bulkImport.isPending}
          className="flex items-center gap-2 bg-[#C9A96E] text-black px-5 py-3 text-sm font-semibold hover:bg-[#D4B87A] disabled:opacity-40 transition-colors rounded"
        >
          {bulkImport.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Import
        </button>
      </div>
    </motion.div>
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <p className="text-sm text-white/40">{items.length} items on the menu</p>
        <div className="flex items-center gap-3">
          <BulkImportSection />
          <button data-testid="button-add-menu" onClick={() => setAdding(true)} className="flex items-center gap-2 bg-[#C9A96E] text-black px-4 py-3 text-sm font-semibold hover:bg-[#D4B87A] transition-colors rounded"><Plus size={16} /> Add Item</button>
        </div>
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
          { key: "category", label: "Category", render: (v: string) => <span className="text-xs uppercase tracking-wider text-white/45 font-medium">{v}</span> },
          { key: "description", label: "Description" },
          { key: "available", label: "Available", render: (v: boolean, row: any) => (
            <button data-testid={`toggle-avail-${row.id}`} onClick={() => toggle.mutate({ id: row.id, available: !v })} className={`w-9 h-[22px] rounded-full transition-colors relative ${v ? "bg-[#C9A96E]" : "bg-white/10"}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-[3px] transition-transform ${v ? "left-[19px]" : "left-[3px]"}`} />
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
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-white/40">{items.length} inventory items</p>
        <button data-testid="button-add-inventory" onClick={() => setAdding(true)} className="flex items-center gap-2 bg-[#C9A96E] text-black px-4 py-3 text-sm font-semibold hover:bg-[#D4B87A] transition-colors rounded"><Plus size={16} /> Add Item</button>
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
            return <span className={q <= t ? "text-red-400 font-semibold" : ""}>{v} {row.unit}</span>;
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
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-white/40">{staff.length} staff members</p>
        <button data-testid="button-add-staff" onClick={() => setAdding(true)} className="flex items-center gap-2 bg-[#C9A96E] text-black px-4 py-3 text-sm font-semibold hover:bg-[#D4B87A] transition-colors rounded"><Plus size={16} /> Add Staff</button>
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
          { key: "role", label: "Role", render: (v: string) => <span className="text-xs uppercase tracking-wider text-[#C9A96E]/70 font-medium">{v}</span> },
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
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-white/40">{bookingsList.length} bookings</p>
        <button data-testid="button-add-booking" onClick={() => setAdding(true)} className="flex items-center gap-2 bg-[#C9A96E] text-black px-4 py-3 text-sm font-semibold hover:bg-[#D4B87A] transition-colors rounded"><Plus size={16} /> Add Booking</button>
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
          { key: "eventType", label: "Type", render: (v: string) => <span className="text-xs uppercase tracking-wider text-[#C9A96E]/70 font-medium">{v}</span> },
          { key: "guestName", label: "Guest" },
          { key: "guestCount", label: "Count" },
          { key: "status", label: "Status", render: (v: string) => {
            const colors: Record<string, string> = { confirmed: "text-emerald-400/70", cancelled: "text-red-400/70", pending: "text-white/30" };
            return <span className={`text-xs uppercase tracking-wider font-medium ${colors[v] || "text-white/40"}`}>{v}</span>;
          }},
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
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-white/40">{guestList.length} guests, {guestList.filter((g: any) => g.vipStatus).length} VIP</p>
        <button data-testid="button-add-guest" onClick={() => setAdding(true)} className="flex items-center gap-2 bg-[#C9A96E] text-black px-4 py-3 text-sm font-semibold hover:bg-[#D4B87A] transition-colors rounded"><Plus size={16} /> Add Guest</button>
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
          { key: "vipStatus", label: "VIP", render: (v: boolean) => v ? <span className="text-xs uppercase tracking-wider text-[#C9A96E] font-bold">VIP</span> : "—" },
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
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-white/40">{supplierList.length} suppliers</p>
        <button data-testid="button-add-supplier" onClick={() => setAdding(true)} className="flex items-center gap-2 bg-[#C9A96E] text-black px-4 py-3 text-sm font-semibold hover:bg-[#D4B87A] transition-colors rounded"><Plus size={16} /> Add Supplier</button>
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 lg:py-16">
        <div className="mb-8 sm:mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-[#C9A96E]/60 font-medium mb-2 sm:mb-3">Venue Management</p>
          <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight mb-2" data-testid="text-venue-title">Venue Data</h1>
          <p className="text-sm text-white/40 max-w-lg">
            Manage the data your voice agents use — menus, inventory, staff, bookings, and guests.
          </p>
        </div>

        <nav className="flex gap-1 mb-8 sm:mb-10 overflow-x-auto pb-1" data-testid="venue-tabs">
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                data-testid={`tab-${key}`}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-sm sm:text-base font-medium whitespace-nowrap transition-all duration-200 relative rounded ${
                  isActive
                    ? "text-white bg-white/[0.06]"
                    : "text-white/35 hover:text-white/50 hover:bg-white/[0.03]"
                }`}
              >
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A96E]" />
                )}
                <Icon size={16} className={isActive ? "text-[#C9A96E]" : ""} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </nav>

        <div>
          {activeTab === "menu" && <MenuTab />}
          {activeTab === "inventory" && <InventoryTab />}
          {activeTab === "staff" && <StaffTab />}
          {activeTab === "bookings" && <BookingsTab />}
          {activeTab === "guests" && <GuestsTab />}
          {activeTab === "suppliers" && <SuppliersTab />}
        </div>
      </div>
    </DashboardLayout>
  );
}
