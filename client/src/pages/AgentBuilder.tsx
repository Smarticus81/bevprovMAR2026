import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getToolsForAgentType } from "@/lib/agentTools";
import type { Agent, AgentConfig, AgentTool } from "@shared/schema";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { VoiceTestPanel } from "@/components/VoiceTestPanel";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

export default function AgentBuilder() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [language, setLanguage] = useState("en");
  const [speed, setSpeed] = useState(1);
  const [greeting, setGreeting] = useState("");
  const [squareEnabled, setSquareEnabled] = useState(false);
  const [toastEnabled, setToastEnabled] = useState(false);
  const [operatingHoursStart, setOperatingHoursStart] = useState("09:00");
  const [operatingHoursEnd, setOperatingHoursEnd] = useState("22:00");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [maxConversationLength, setMaxConversationLength] = useState(10);
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});
  const [isActive, setIsActive] = useState(false);

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ["/api/agents", id],
    enabled: !!id,
  });

  const { data: savedTools } = useQuery<AgentTool[]>({
    queryKey: ["/api/agents", id, "tools"],
    enabled: !!id,
  });

  useEffect(() => {
    if (agent) {
      setName(agent.name || "");
      setDescription(agent.description || "");
      const c = agent.config as AgentConfig | null;
      setVoice(c?.voice || "alloy");
      setLanguage(c?.language || "en");
      setSpeed(c?.speed || 1);
      setGreeting(c?.greeting || "");
      setSquareEnabled(c?.squareEnabled || false);
      setToastEnabled(c?.toastEnabled || false);
      setOperatingHoursStart(c?.operatingHours?.start || "09:00");
      setOperatingHoursEnd(c?.operatingHours?.end || "22:00");
      setFallbackMessage(c?.fallbackMessage || "");
      setMaxConversationLength(c?.maxConversationLength || 10);
      setIsActive(agent.status === "active");
    }
  }, [agent]);

  useEffect(() => {
    if (savedTools && agent) {
      const toolMap: Record<string, boolean> = {};
      const available = getToolsForAgentType(agent.type);
      available.forEach((t) => {
        toolMap[t.name] = false;
      });
      savedTools.forEach((t) => {
        toolMap[t.toolName] = t.enabled;
      });
      setEnabledTools(toolMap);
    }
  }, [savedTools, agent]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/agents/${id}`, {
        name,
        description,
        status: isActive ? "active" : "draft",
        config: {
          voice,
          language,
          speed,
          greeting,
          squareEnabled,
          toastEnabled,
          operatingHours: { start: operatingHoursStart, end: operatingHoursEnd },
          fallbackMessage,
          maxConversationLength,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id] });
      toast({ title: "Agent saved", description: "Your changes have been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const saveToolsMutation = useMutation({
    mutationFn: async () => {
      const tools = Object.entries(enabledTools).map(([toolName, enabled]) => {
        const def = getToolsForAgentType(agent!.type).find((t) => t.name === toolName);
        return {
          agentId: Number(id),
          toolName,
          toolCategory: def?.category || "Unknown",
          enabled,
          config: {},
        };
      });
      await apiRequest("PUT", `/api/agents/${id}/tools`, { tools });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "tools"] });
      toast({ title: "Tools saved", description: "Tool configuration has been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveAll = () => {
    saveMutation.mutate();
    saveToolsMutation.mutate();
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!agent) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-gray-500" data-testid="text-agent-not-found">
          Agent not found.
        </div>
      </DashboardLayout>
    );
  }

  const availableTools = getToolsForAgentType(agent.type);
  const toolsByCategory = availableTools.reduce<Record<string, typeof availableTools>>((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {});

  const isSaving = saveMutation.isPending || saveToolsMutation.isPending;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" data-testid="link-back-dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="text-agent-name-header">
                {name || "Untitled Agent"}
              </h1>
              <p className="text-sm text-gray-500">{agent.type}</p>
            </div>
          </div>
          <Button
            onClick={handleSaveAll}
            disabled={isSaving}
            data-testid="button-save-agent"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-white border border-gray-200 w-full justify-start flex-wrap h-auto p-1 gap-1">
            <TabsTrigger value="general" data-testid="tab-general">General</TabsTrigger>
            <TabsTrigger value="voice" data-testid="tab-voice">Voice</TabsTrigger>
            <TabsTrigger value="tools" data-testid="tab-tools">Tools</TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
            <TabsTrigger value="review" data-testid="tab-review">Review</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">General Information</h2>
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter agent name"
                  data-testid="input-agent-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-description">Description</Label>
                <Textarea
                  id="agent-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this agent does"
                  rows={4}
                  data-testid="input-agent-description"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="voice">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Voice Configuration</h2>
              <div className="space-y-2">
                <Label>Voice</Label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger data-testid="select-voice">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICES.map((v) => (
                      <SelectItem key={v} value={v} data-testid={`select-voice-option-${v}`}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value} data-testid={`select-language-option-${l.value}`}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Speed: {speed.toFixed(1)}x</Label>
                <Slider
                  value={[speed]}
                  onValueChange={([v]) => setSpeed(v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  data-testid="slider-speed"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>2.0x</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="greeting">Greeting Message</Label>
                <Textarea
                  id="greeting"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Hi! How can I help you today?"
                  rows={3}
                  data-testid="input-greeting"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tools">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Tools</h2>
                <Badge variant="secondary" data-testid="text-tools-count">
                  {Object.values(enabledTools).filter(Boolean).length} / {availableTools.length} enabled
                </Badge>
              </div>
              {Object.entries(toolsByCategory).map(([category, tools]) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{category}</h3>
                  <div className="space-y-2">
                    {tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900" data-testid={`text-tool-name-${tool.name}`}>
                            {tool.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </p>
                          <p className="text-xs text-gray-500">{tool.description}</p>
                        </div>
                        <Switch
                          checked={enabledTools[tool.name] || false}
                          onCheckedChange={(checked) =>
                            setEnabledTools((prev) => ({ ...prev, [tool.name]: checked }))
                          }
                          data-testid={`switch-tool-${tool.name}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="integrations">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">Square POS</p>
                  <p className="text-xs text-gray-500">Connect to Square for payments and orders</p>
                </div>
                <Switch
                  checked={squareEnabled}
                  onCheckedChange={setSquareEnabled}
                  data-testid="switch-square"
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">Toast POS</p>
                  <p className="text-xs text-gray-500">Connect to Toast for restaurant operations</p>
                </div>
                <Switch
                  checked={toastEnabled}
                  onCheckedChange={setToastEnabled}
                  data-testid="switch-toast"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
              <div className="space-y-2">
                <Label>Operating Hours</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="time"
                    value={operatingHoursStart}
                    onChange={(e) => setOperatingHoursStart(e.target.value)}
                    data-testid="input-hours-start"
                  />
                  <span className="text-gray-400">to</span>
                  <Input
                    type="time"
                    value={operatingHoursEnd}
                    onChange={(e) => setOperatingHoursEnd(e.target.value)}
                    data-testid="input-hours-end"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fallback">Fallback Message</Label>
                <Textarea
                  id="fallback"
                  value={fallbackMessage}
                  onChange={(e) => setFallbackMessage(e.target.value)}
                  placeholder="Sorry, I didn't understand that. Could you please repeat?"
                  rows={3}
                  data-testid="input-fallback-message"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Conversation Length: {maxConversationLength} messages</Label>
                <Slider
                  value={[maxConversationLength]}
                  onValueChange={([v]) => setMaxConversationLength(v)}
                  min={1}
                  max={50}
                  step={1}
                  data-testid="slider-max-conversation"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>1</span>
                  <span>25</span>
                  <span>50</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="review">
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Review & Activate</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gray-50 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Name</p>
                  <p className="text-sm font-medium text-gray-900" data-testid="text-review-name">{name || "—"}</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Type</p>
                  <p className="text-sm font-medium text-gray-900" data-testid="text-review-type">{agent.type}</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Voice</p>
                  <p className="text-sm font-medium text-gray-900" data-testid="text-review-voice">
                    {voice.charAt(0).toUpperCase() + voice.slice(1)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Language</p>
                  <p className="text-sm font-medium text-gray-900" data-testid="text-review-language">
                    {LANGUAGES.find((l) => l.value === language)?.label || language}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Speed</p>
                  <p className="text-sm font-medium text-gray-900" data-testid="text-review-speed">{speed.toFixed(1)}x</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Tools Enabled</p>
                  <p className="text-sm font-medium text-gray-900" data-testid="text-review-tools">
                    {Object.values(enabledTools).filter(Boolean).length} / {availableTools.length}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Integrations</p>
                  <p className="text-sm font-medium text-gray-900" data-testid="text-review-integrations">
                    {[squareEnabled && "Square", toastEnabled && "Toast"].filter(Boolean).join(", ") || "None"}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Operating Hours</p>
                  <p className="text-sm font-medium text-gray-900" data-testid="text-review-hours">
                    {operatingHoursStart} - {operatingHoursEnd}
                  </p>
                </div>
              </div>
              {description && (
                <div className="p-4 rounded-lg bg-gray-50 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Description</p>
                  <p className="text-sm text-gray-700" data-testid="text-review-description">{description}</p>
                </div>
              )}
              {greeting && (
                <div className="p-4 rounded-lg bg-gray-50 space-y-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Greeting</p>
                  <p className="text-sm text-gray-700" data-testid="text-review-greeting">{greeting}</p>
                </div>
              )}
              <div className="flex items-center justify-between p-4 rounded-lg border-2 border-gray-200">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className={`w-5 h-5 ${isActive ? "text-green-500" : "text-gray-300"}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {isActive ? "Agent is Active" : "Agent is Inactive"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isActive ? "This agent is live and responding to requests" : "Activate to make this agent available"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  data-testid="switch-activate"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSaveAll}
                disabled={isSaving}
                data-testid="button-save-and-activate"
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save & {isActive ? "Activate" : "Deactivate"}
              </Button>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Voice Test</h3>
                <VoiceTestPanel agentId={parseInt(id!)} agentName={name} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
