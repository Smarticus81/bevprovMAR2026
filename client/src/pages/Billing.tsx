import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Check, CreditCard, ExternalLink, Loader2, ArrowUpRight, Shield, Zap, Crown, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useSearch } from "wouter";

const PLAN_DETAILS: Record<string, { label: string; icon: any; features: string[]; color: string }> = {
  starter: {
    label: "Starter",
    icon: Zap,
    color: "text-white/60",
    features: ["1 venue", "2 agents", "500 voice minutes/mo", "Email support"],
  },
  pro: {
    label: "Pro",
    icon: Crown,
    color: "text-[#C9A96E]",
    features: ["3 venues", "Unlimited agents", "2,000 voice minutes/mo", "Priority support", "Square & Toast integration"],
  },
  enterprise: {
    label: "Enterprise",
    icon: Shield,
    color: "text-purple-400",
    features: ["Unlimited venues", "Unlimited agents", "Unlimited voice minutes", "Dedicated support", "Custom integrations", "SLA guarantee"],
  },
};

export default function Billing() {
  const { organization } = useAuth();
  const qc = useQueryClient();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("success") === "true") {
      setSuccessMsg("Subscription activated! Your plan has been upgraded.");
      syncMutation.mutate();
    }
    if (params.get("canceled") === "true") {
      setCancelMsg("Checkout canceled. You can try again anytime.");
    }
  }, []);

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: async () => {
      const r = await fetch("/api/billing/subscription", { credentials: "include" });
      return r.json();
    },
  });

  const { data: limits } = useQuery({
    queryKey: ["billing", "limits"],
    queryFn: async () => {
      const r = await fetch("/api/billing/limits", { credentials: "include" });
      return r.json();
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["billing", "products"],
    queryFn: async () => {
      const r = await fetch("/api/billing/products");
      return r.json();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const r = await apiRequest("POST", "/api/billing/checkout", { priceId });
      return r.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/billing/portal");
      return r.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/billing/sync-subscription");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  const currentPlan = organization?.plan || "starter";
  const planInfo = PLAN_DETAILS[currentPlan] || PLAN_DETAILS.starter;
  const PlanIcon = planInfo.icon;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 lg:py-16">
        <div className="mb-8 sm:mb-12">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#C9A96E]/50 font-medium mb-2 sm:mb-3">Account</p>
          <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight mb-2" data-testid="text-billing-title">Billing & Subscription</h1>
          <p className="text-xs sm:text-sm text-white/30 max-w-lg">
            Manage your subscription, upgrade your plan, and view billing details.
          </p>
        </div>

        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
            <Check size={16} className="text-emerald-400" />
            <p className="text-sm text-emerald-400" data-testid="text-success-msg">{successMsg}</p>
          </motion.div>
        )}

        {cancelMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
            <AlertCircle size={16} className="text-amber-400" />
            <p className="text-sm text-amber-400">{cancelMsg}</p>
          </motion.div>
        )}

        <div className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/25 font-medium mb-4">Current Plan</p>
          <div className="border border-white/[0.06] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/[0.03]">
                <PlanIcon size={20} className={planInfo.color} />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white" data-testid="text-current-plan">{planInfo.label} Plan</h3>
                <p className="text-xs text-white/30 mt-0.5">
                  {subscription?.subscription?.status === "active" ? "Active subscription" : currentPlan === "starter" ? "Free tier — no billing" : "No active subscription"}
                </p>
              </div>
            </div>
            {organization?.stripeCustomerId && (
              <button
                data-testid="button-manage-billing"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="flex items-center gap-2 text-[#C9A96E] hover:text-[#D4B87A] text-sm font-medium transition-colors"
              >
                {portalMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                Manage Billing
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>

        {limits && (
          <div className="mb-10">
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/25 font-medium mb-4">Usage</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-white/[0.06] p-5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-white/25 font-medium mb-2">Agents</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-light text-white" data-testid="text-agent-usage">{limits.usage?.agents ?? 0}</span>
                  <span className="text-sm text-white/20">/ {limits.limits?.agents === "unlimited" ? "∞" : limits.limits?.agents}</span>
                </div>
                {limits.limits?.agents !== "unlimited" && limits.usage?.agents >= limits.limits?.agents && (
                  <p className="text-[10px] text-amber-400/70 mt-2">Limit reached — upgrade to create more agents</p>
                )}
              </div>
              <div className="border border-white/[0.06] p-5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-white/25 font-medium mb-2">Venues</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-light text-white">1</span>
                  <span className="text-sm text-white/20">/ {limits.limits?.venues === "unlimited" ? "∞" : limits.limits?.venues}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/25 font-medium mb-4">
            {currentPlan === "starter" ? "Upgrade Your Plan" : "Available Plans"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["starter", "pro", "enterprise"] as const).map((planKey) => {
              const info = PLAN_DETAILS[planKey];
              const Icon = info.icon;
              const isCurrent = currentPlan === planKey;
              const product = products.find((p: any) =>
                p.metadata?.bevpro_plan === planKey ||
                p.name?.toLowerCase().includes(planKey)
              );
              const price = product?.prices?.[0];

              return (
                <div
                  key={planKey}
                  data-testid={`card-plan-${planKey}`}
                  className={`border p-6 flex flex-col transition-colors ${
                    isCurrent
                      ? "border-[#C9A96E]/30 bg-[#C9A96E]/[0.03]"
                      : "border-white/[0.06] hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Icon size={18} className={info.color} />
                    <h3 className="text-sm font-semibold text-white">{info.label}</h3>
                    {isCurrent && (
                      <span className="text-[9px] uppercase tracking-wider bg-[#C9A96E]/20 text-[#C9A96E] px-2 py-0.5 font-semibold" data-testid={`badge-current-${planKey}`}>Current</span>
                    )}
                  </div>

                  <div className="mb-4">
                    {planKey === "enterprise" ? (
                      <span className="text-xl font-light text-white">Custom</span>
                    ) : (
                      <span className="text-xl font-light text-white">
                        ${planKey === "starter" ? "49" : "149"}
                        <span className="text-xs text-white/30">/mo</span>
                      </span>
                    )}
                  </div>

                  <ul className="space-y-2 flex-1 mb-5">
                    {info.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-white/40">
                        <Check size={12} className="text-white/20 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="text-center text-xs text-white/20 py-2.5">Active</div>
                  ) : planKey === "enterprise" ? (
                    <a href="mailto:sales@bevpro.ai" data-testid="button-contact-sales" className="block text-center border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20 py-2.5 text-xs font-medium transition-colors">
                      Contact Sales
                    </a>
                  ) : price ? (
                    <button
                      data-testid={`button-upgrade-${planKey}`}
                      onClick={() => checkoutMutation.mutate(price.id)}
                      disabled={checkoutMutation.isPending}
                      className="flex items-center justify-center gap-2 bg-[#C9A96E] text-black py-2.5 text-xs font-semibold hover:bg-[#D4B87A] disabled:opacity-40 transition-colors"
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <ArrowUpRight size={14} />
                          {currentPlan === "starter" ? "Upgrade" : "Switch"}
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      data-testid={`button-upgrade-${planKey}`}
                      onClick={() => {
                        window.location.href = `/register?plan=${planKey}`;
                      }}
                      className="flex items-center justify-center gap-2 bg-[#C9A96E] text-black py-2.5 text-xs font-semibold hover:bg-[#D4B87A] transition-colors"
                    >
                      <ArrowUpRight size={14} />
                      {currentPlan === "starter" ? "Upgrade" : "Switch"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border border-white/[0.06] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/60">Need help with your plan?</p>
            <p className="text-xs text-white/25 mt-1">Contact our team for questions about billing, enterprise pricing, or plan changes.</p>
          </div>
          <a href="mailto:support@bevpro.ai" className="text-[#C9A96E] text-sm hover:text-[#D4B87A] transition-colors">Contact Support</a>
        </div>
      </div>
    </DashboardLayout>
  );
}
