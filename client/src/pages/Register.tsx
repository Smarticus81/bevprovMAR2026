import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, Check, ArrowRight } from "lucide-react";
import { BevProLogo, BevProWordmark } from "@/components/BevProLogo";
import { motion } from "framer-motion";

const PLANS = [
  { id: "starter", name: "Starter", price: "$49", period: "/mo", desc: "1 venue, 3 agents" },
  { id: "pro", name: "Pro", price: "$149", period: "/mo", desc: "5 venues, unlimited agents" },
  { id: "enterprise", name: "Enterprise", price: "Custom", period: "", desc: "Dedicated support" },
];

const registerSchema = z.object({
  venueName: z.string().min(2, "Venue name must be at least 2 characters"),
  name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const { register: registerUser } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const [selectedPlan, setSelectedPlan] = useState(params.get("plan") || "starter");
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: authConfig } = useQuery({
    queryKey: ["auth-config"],
    queryFn: async () => {
      const res = await fetch("/api/auth/config");
      return res.json();
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = (data: RegisterFormData) => {
    setServerError(null);
    registerUser.mutate(
      { ...data, plan: selectedPlan },
      {
        onSuccess: () => {
          setLocation("/dashboard");
        },
        onError: (error: Error) => {
          setServerError(
            error.message.includes("409")
              ? "An account with this email already exists"
              : "Something went wrong. Please try again."
          );
        },
      }
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/register-bg.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60" />

      <div className="relative z-10 min-h-screen flex">
        <div className="w-full lg:w-[520px] xl:w-[560px] flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link href="/" className="inline-flex items-center gap-2.5 mb-10" data-testid="link-home">
              <BevProLogo size={32} />
              <BevProWordmark className="text-xl text-white" />
            </Link>

            <h1 className="text-3xl font-light text-white tracking-tight mb-2">
              Get started
            </h1>
            <p className="text-white/50 text-base mb-8">
              Set up your venue and start building voice agents
            </p>

            {serverError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                data-testid="text-register-error"
                className="flex items-center gap-2.5 p-4 rounded-lg bg-red-500/10 border border-red-500/15 text-red-400 text-base mb-6"
              >
                <AlertCircle size={16} className="shrink-0" />
                {serverError}
              </motion.div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label htmlFor="venueName" className="text-xs uppercase tracking-[0.15em] text-white/50 font-medium block mb-2">Venue Name</label>
                <input
                  id="venueName"
                  data-testid="input-venue-name"
                  placeholder="The Grand Ballroom"
                  className="w-full bg-white/[0.04] border-0 border-b border-white/10 rounded-none px-0 py-4 text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[#C9A96E]/50 transition-colors"
                  {...register("venueName")}
                />
                {errors.venueName && (
                  <p data-testid="text-venue-error" className="text-red-400 text-sm mt-2">{errors.venueName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="name" className="text-xs uppercase tracking-[0.15em] text-white/50 font-medium block mb-2">Full Name</label>
                <input
                  id="name"
                  data-testid="input-name"
                  placeholder="Jane Smith"
                  className="w-full bg-white/[0.04] border-0 border-b border-white/10 rounded-none px-0 py-4 text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[#C9A96E]/50 transition-colors"
                  {...register("name")}
                />
                {errors.name && (
                  <p data-testid="text-name-error" className="text-red-400 text-sm mt-2">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="text-xs uppercase tracking-[0.15em] text-white/50 font-medium block mb-2">Email</label>
                <input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  placeholder="jane@venue.com"
                  className="w-full bg-white/[0.04] border-0 border-b border-white/10 rounded-none px-0 py-4 text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[#C9A96E]/50 transition-colors"
                  {...register("email")}
                />
                {errors.email && (
                  <p data-testid="text-email-error" className="text-red-400 text-sm mt-2">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="text-xs uppercase tracking-[0.15em] text-white/50 font-medium block mb-2">Password</label>
                <input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-white/[0.04] border-0 border-b border-white/10 rounded-none px-0 py-4 text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[#C9A96E]/50 transition-colors"
                  {...register("password")}
                />
                {errors.password && (
                  <p data-testid="text-password-error" className="text-red-400 text-sm mt-2">{errors.password.message}</p>
                )}
              </div>

              <div className="pt-1">
                <label className="text-xs uppercase tracking-[0.15em] text-white/50 font-medium block mb-3">Plan</label>
                <div className="flex gap-2">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      data-testid={`button-plan-${plan.id}`}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`flex-1 relative py-3 px-3 text-center transition-all duration-300 ${
                        selectedPlan === plan.id
                          ? "border-b-2 border-[#C9A96E] text-white"
                          : "border-b border-white/10 text-white/35 hover:text-white/60"
                      }`}
                    >
                      {selectedPlan === plan.id && (
                        <div className="absolute top-2 right-2">
                          <Check size={10} className="text-[#C9A96E]" />
                        </div>
                      )}
                      <div className="text-base font-medium">{plan.name}</div>
                      <div className="text-xs mt-0.5 opacity-60">
                        {plan.price}<span className="opacity-50">{plan.period}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  data-testid="button-register"
                  disabled={registerUser.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-[#C9A96E] text-black py-4 text-base font-semibold tracking-wide uppercase hover:bg-[#D4B87A] disabled:opacity-50 transition-all duration-300"
                >
                  {registerUser.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Create Account
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>

            {authConfig?.googleEnabled && (
              <>
                <div className="flex items-center gap-4 my-5">
                  <div className="flex-1 h-px bg-white/8" />
                  <span className="text-[11px] text-white/25 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>
                <a
                  href="/api/auth/google"
                  data-testid="button-google-register"
                  className="flex items-center justify-center gap-3 w-full border border-white/10 text-white/70 py-4 text-base font-medium hover:bg-white/5 hover:text-white transition-all duration-300"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </a>
              </>
            )}

            <p className="mt-8 text-base text-white/40">
              Already have an account?{" "}
              <Link href="/login" data-testid="link-login" className="text-white/60 hover:text-white transition-colors">
                Sign in
              </Link>
            </p>
          </motion.div>
        </div>

        <div className="hidden lg:flex flex-1 items-end justify-end p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="max-w-sm"
          >
            <div className="backdrop-blur-md bg-black/30 border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#C9A96E] animate-pulse" />
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#C9A96E]/80 font-medium">Live at Venue</span>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                Voice-powered ordering, inventory tracking, and venue management — all through a single earbud.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
