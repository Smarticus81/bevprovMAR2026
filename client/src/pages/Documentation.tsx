import { useState } from "react";
import { Link } from "wouter";
import { BevProLogo, BevProWordmark } from "@/components/BevProLogo";
import {
  UserPlus,
  LogIn,
  Bot,
  Mic,
  Store,
  Box,
  Briefcase,
  Sparkles,
  Database,
  Upload,
  Volume2,
  Settings,
  ChevronRight,
  ArrowLeft,
  FileJson,
  FileSpreadsheet,
  Wand2,
  Layers,
  MonitorSpeaker,
  CheckCircle2,
} from "lucide-react";

const GOLD = "#C9A96E";

const SECTIONS = [
  { id: "getting-started", label: "Getting Started" },
  { id: "first-agent", label: "Your First Agent" },
  { id: "agent-types", label: "Agent Types" },
  { id: "venue-data", label: "Venue Data" },
  { id: "voice-agents", label: "Using Voice Agents" },
  { id: "bulk-import", label: "Bulk Import" },
];

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-lg bg-[#C9A96E]/10 border border-[#C9A96E]/20">
          <Icon size={20} className="text-[#C9A96E]" />
        </div>
        <h2 className="text-2xl font-semibold text-white tracking-wide" data-testid={`text-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>{title}</h2>
      </div>
      <p className="text-white/40 text-sm ml-[52px]">{subtitle}</p>
    </div>
  );
}

function Step({ number, title, description, tips }: { number: number; title: string; description: string; tips?: string[] }) {
  return (
    <div className="flex gap-4 mb-6" data-testid={`step-${number}`}>
      <div className="shrink-0 w-8 h-8 rounded-full bg-[#C9A96E]/20 border border-[#C9A96E]/30 flex items-center justify-center">
        <span className="text-sm font-semibold text-[#C9A96E]">{number}</span>
      </div>
      <div className="flex-1">
        <h3 className="text-white/90 font-medium text-sm mb-1">{title}</h3>
        <p className="text-white/50 text-sm leading-relaxed">{description}</p>
        {tips && tips.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-white/40">
                <CheckCircle2 size={13} className="text-[#C9A96E]/60 mt-0.5 shrink-0" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentTypeCard({ icon: Icon, name, description }: { icon: React.ElementType; name: string; description: string }) {
  return (
    <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg" data-testid={`card-agent-type-${name.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-white/[0.04]">
          <Icon size={16} className="text-[#C9A96E]" />
        </div>
        <h3 className="text-sm font-medium text-white/90">{name}</h3>
      </div>
      <p className="text-xs text-white/50 leading-relaxed">{description}</p>
    </div>
  );
}

export default function Documentation() {
  const [activeSection, setActiveSection] = useState("getting-started");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 w-full bg-black/90 backdrop-blur-xl border-b border-white/[0.06] z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-docs-home">
            <BevProLogo size={22} />
            <BevProWordmark className="text-white" size="text-base" />
          </Link>
          <div className="h-5 w-px bg-white/10 hidden sm:block" />
          <span className="text-white/30 text-sm hidden sm:block tracking-wide">Documentation</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" data-testid="link-docs-dashboard" className="text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
            <ArrowLeft size={12} />
            Dashboard
          </Link>
          <Link href="/register" data-testid="link-docs-signup" className="border border-[#C9A96E]/30 text-[#C9A96E] rounded-full px-4 py-1.5 text-xs hover:bg-[#C9A96E]/10 transition-colors">
            Get Started
          </Link>
        </div>
      </header>

      <div className="flex pt-16">
        <aside className="hidden lg:block w-56 fixed h-[calc(100vh-64px)] top-16 border-r border-white/[0.06] bg-white/[0.01]">
          <nav className="p-4 space-y-0.5">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                data-testid={`link-doc-section-${section.id}`}
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-all relative ${
                  activeSection === section.id
                    ? "text-white bg-white/[0.04]"
                    : "text-white/30 hover:text-white/50 hover:bg-white/[0.02]"
                }`}
              >
                {activeSection === section.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#C9A96E]" />
                )}
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 lg:ml-56 px-6 md:px-12 lg:px-16 py-12 max-w-4xl">
          <div className="mb-16">
            <h1 className="text-4xl font-bold text-white tracking-tight mb-3" data-testid="text-docs-title">BevPro Documentation</h1>
            <p className="text-white/40 text-base leading-relaxed max-w-2xl">
              Everything you need to set up, configure, and run your AI-powered venue operations.
              Written in plain language — no technical expertise required.
            </p>
          </div>

          <section id="getting-started" className="mb-20 scroll-mt-24">
            <SectionHeader icon={UserPlus} title="Getting Started" subtitle="Create your account and get oriented in under 5 minutes." />
            <Step
              number={1}
              title="Create Your Account"
              description={"Visit the BevPro homepage and click \"Start Building.\" Fill in your name, email, and password. You'll also enter your organization name — this is your venue or company."}
              tips={["Your organization name can be changed later in settings.", "All team members under one organization share the same agents and data."]}
            />
            <Step
              number={2}
              title="Log In to Your Dashboard"
              description="After registering, you'll be taken to your dashboard automatically. This is your command center — you'll see your agents, venue data, and the app store from here."
              tips={["Bookmark your dashboard for quick access.", "The sidebar on the left lets you navigate between sections."]}
            />
            <Step
              number={3}
              title="Explore the Dashboard"
              description="Your dashboard has three main sections: Agents (where you build and manage AI assistants), Venue Data (menus, inventory, staff, bookings, guests, suppliers), and the App Store (pre-built agent templates)."
              tips={["Start with the App Store to deploy a pre-built agent quickly.", "Or jump to Agents to build a custom one from scratch."]}
            />
          </section>

          <section id="first-agent" className="mb-20 scroll-mt-24">
            <SectionHeader icon={Wand2} title="Creating Your First Agent" subtitle="Walk through the Agent Builder step by step." />
            <Step
              number={1}
              title='Click "New Agent" on Your Dashboard'
              description="From the Agents page, click the New Agent button. This opens the Agent Builder — a guided wizard that walks you through every setting."
            />
            <Step
              number={2}
              title="Choose a Name & Type"
              description="Give your agent a name (e.g., 'Bar Assistant') and select its type. The type determines what your agent specializes in — order processing, inventory tracking, or general concierge duties."
              tips={["The name appears when customers or staff interact with the agent.", "You can change the type later, but it's best to choose correctly upfront."]}
            />
            <Step
              number={3}
              title="Set the Personality & System Prompt"
              description="Write a short description of how your agent should behave. For example: 'You are a friendly bartender assistant that helps customers with drink recommendations and takes orders.' This is called the system prompt."
              tips={["Keep it conversational and specific to your venue.", "Mention your venue name, style, and any rules (e.g., 'always suggest our house cocktails first')."]}
            />
            <Step
              number={4}
              title="Configure Voice & Behavior"
              description="Choose your agent's voice (male, female, different accents), set the wake word (a phrase that activates the agent), and configure how the agent responds."
              tips={["Wake word is enabled by default — say the phrase to activate your agent hands-free.", "Test different voices to find one that matches your brand."]}
            />
            <Step
              number={5}
              title="Connect Integrations (Optional)"
              description="Link your POS system (Square, Toast), external databases, or MCP endpoints. This lets your agent access real data — menus, transactions, inventory levels."
              tips={["You can skip this step and add integrations later.", "POS integration requires your API key from your POS provider."]}
            />
            <Step
              number={6}
              title="Review & Deploy"
              description="Review all your settings on the final step. Click Deploy to make your agent live. You'll get a unique link to access your agent from any device."
            />
          </section>

          <section id="agent-types" className="mb-20 scroll-mt-24">
            <SectionHeader icon={Layers} title="Agent Types Explained" subtitle="Understanding what each agent type does and when to use it." />
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <AgentTypeCard
                icon={Sparkles}
                name="BevOne (Concierge)"
                description="Your master assistant. BevOne can answer questions about any part of your venue — sales, inventory, events, staff. It coordinates across all other agents and gives you a unified view of operations."
              />
              <AgentTypeCard
                icon={Mic}
                name="Voice POS"
                description="Designed for bartenders and servers. Process drink and food orders entirely by voice — no tapping screens. It understands natural language like 'two old fashioneds and a cab sauv for table 6.'"
              />
              <AgentTypeCard
                icon={Store}
                name="POS Integration"
                description="Connects to your existing point-of-sale system (Square, Toast, Clover). Syncs transactions, receipts, and menu data in real time so your agents always have current information."
              />
              <AgentTypeCard
                icon={Box}
                name="Inventory Agent"
                description="Monitors your stock levels automatically. It alerts you when items are running low, predicts when you'll run out based on usage patterns, and can auto-reorder from your suppliers."
              />
              <AgentTypeCard
                icon={Briefcase}
                name="Venue Agent"
                description="Handles event management, staff scheduling, calendars, and multi-location coordination. Perfect for venues with regular events, private bookings, or multiple locations."
              />
            </div>
            <div className="p-4 bg-[#C9A96E]/5 border border-[#C9A96E]/15 rounded-lg">
              <p className="text-xs text-[#C9A96E]/80 leading-relaxed">
                <strong>Tip:</strong> You can run multiple agents simultaneously. Many venues use a BevOne concierge alongside a Voice POS and an Inventory Agent — they all share the same venue data.
              </p>
            </div>
          </section>

          <section id="venue-data" className="mb-20 scroll-mt-24">
            <SectionHeader icon={Database} title="Venue Data" subtitle="How to add and manage your menus, inventory, staff, bookings, guests, and suppliers." />
            <div className="space-y-2 mb-8">
              <h3 className="text-white/70 text-sm font-medium mb-3">The Venue Data page has six tabs:</h3>
              <div className="grid gap-3">
                {[
                  { title: "Menu", desc: "Add your drinks, cocktails, food items with prices and descriptions. Your agents reference this when taking orders or making recommendations." },
                  { title: "Inventory", desc: "Track stock levels of spirits, mixers, garnishes, and supplies. Set reorder thresholds so your Inventory Agent knows when to alert you." },
                  { title: "Staff", desc: "Manage your team — bartenders, servers, hosts, and managers. Keep contact info and roles organized." },
                  { title: "Bookings", desc: "Log upcoming events, private bookings, weddings, and special occasions. Track guest counts, dates, and status." },
                  { title: "Guests", desc: "Maintain your guest database with contact info, visit history, spending, and VIP status." },
                  { title: "Suppliers", desc: "Keep track of your suppliers, contact details, and the products they provide." },
                ].map((tab) => (
                  <div key={tab.title} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <ChevronRight size={14} className="text-[#C9A96E] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white/80">{tab.title}</p>
                      <p className="text-xs text-white/40 mt-0.5">{tab.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Step
              number={1}
              title="Navigate to Venue Data"
              description={"Click \"Venue Data\" in the sidebar (or bottom nav on mobile). You'll see tabs for Menu, Inventory, Staff, Bookings, Guests, and Suppliers."}
            />
            <Step
              number={2}
              title="Add Items Manually"
              description="In any tab, use the Add form at the bottom. Fill in the fields (name, category, price, etc.) and click the Add button. The item appears in your list immediately."
              tips={["All fields are validated — you'll see an error if something is missing.", "Items are saved to your organization's data and shared across all agents."]}
            />
            <Step
              number={3}
              title="Edit or Remove Items"
              description="Click on any item to edit it, or use the delete button to remove it. Changes take effect immediately for all your agents."
            />
          </section>

          <section id="voice-agents" className="mb-20 scroll-mt-24">
            <SectionHeader icon={MonitorSpeaker} title="Using Voice Agents" subtitle="How to launch and interact with your voice-enabled agents." />
            <Step
              number={1}
              title="Open Your Agent"
              description="From the dashboard, click on any agent to open it. You'll see the agent interface with a microphone button."
            />
            <Step
              number={2}
              title="Start a Voice Session"
              description="Click the microphone button or say the wake word (if enabled) to start talking. The agent listens, processes your request, and responds with both text and voice."
              tips={["Make sure your browser has microphone permissions enabled.", "Speak naturally — the agent understands conversational language.", "You'll see a visual indicator when the agent is listening."]}
            />
            <Step
              number={3}
              title="Using the Wake Word"
              description='If wake word is enabled (it is by default), you can activate your agent hands-free by saying the configured wake phrase. This is great for bartenders with their hands full.'
              tips={["The default wake word can be customized in the Agent Builder.", "Wake word listening runs continuously when the agent page is open.", "Say the wake word clearly — background noise can affect detection."]}
            />
            <Step
              number={4}
              title="Review Conversation History"
              description="All conversations are displayed in the chat interface. You can scroll back to see previous exchanges. Voice responses are also shown as text."
            />
          </section>

          <section id="bulk-import" className="mb-20 scroll-mt-24">
            <SectionHeader icon={Upload} title="Bulk Import Guide" subtitle="Add many items at once using CSV or JSON files." />
            <p className="text-white/50 text-sm leading-relaxed mb-8">
              Instead of adding menu items one by one, you can upload a file with all your data at once.
              This is perfect for setting up a new venue or migrating from another system.
            </p>

            <div className="grid gap-4 md:grid-cols-2 mb-8">
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <FileJson size={16} className="text-[#C9A96E]" />
                  <h3 className="text-sm font-medium text-white/80">JSON Format</h3>
                </div>
                <div className="bg-black/40 rounded p-3 font-mono text-xs text-white/50 leading-relaxed">
                  <pre>{`[
  {
    "name": "Old Fashioned",
    "category": "Cocktails",
    "price": "14.00",
    "description": "Bourbon, sugar..."
  },
  {
    "name": "Espresso Martini",
    "category": "Cocktails",
    "price": "16.00"
  }
]`}</pre>
                </div>
              </div>
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <FileSpreadsheet size={16} className="text-[#C9A96E]" />
                  <h3 className="text-sm font-medium text-white/80">CSV Format</h3>
                </div>
                <div className="bg-black/40 rounded p-3 font-mono text-xs text-white/50 leading-relaxed">
                  <pre>{`name,category,price,description
Old Fashioned,Cocktails,14.00,Bourbon...
Espresso Martini,Cocktails,16.00,
Margarita,Cocktails,13.00,Tequila...`}</pre>
                </div>
              </div>
            </div>

            <Step
              number={1}
              title="Go to the Menu Tab in Venue Data"
              description="Navigate to Venue Data from the sidebar, then make sure you're on the Menu tab."
            />
            <Step
              number={2}
              title='Choose "Paste JSON/CSV" or "Upload File"'
              description="Next to the Add Item button, you'll see two options: Paste JSON/CSV to type or paste data directly, or Upload File to select a .json, .csv, or .txt file from your computer."
            />
            <Step
              number={3}
              title="Paste or Upload Your Data"
              description='If pasting, enter your JSON array or CSV text into the text area. If uploading, select your file — the system reads it automatically. Then click "Import" to add all items at once.'
              tips={["JSON must be an array of objects with at least a 'name' field.", "CSV files should have a header row with column names like name, price, category.", "You can import up to 500 items at a time."]}
            />
          </section>

          <div className="border-t border-white/[0.06] pt-12 pb-8">
            <div className="text-center">
              <p className="text-white/30 text-sm mb-4">Ready to get started?</p>
              <div className="flex items-center justify-center gap-4">
                <Link href="/register" data-testid="link-docs-bottom-signup" className="bg-[#C9A96E] text-black px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#D4B87A] transition-colors">
                  Create Account
                </Link>
                <Link href="/dashboard" data-testid="link-docs-bottom-dashboard" className="border border-white/20 text-white/60 px-6 py-2.5 rounded-full text-sm hover:bg-white/5 transition-colors">
                  Go to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
