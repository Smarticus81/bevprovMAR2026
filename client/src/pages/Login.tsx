import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { BevProLogo, BevProWordmark } from "@/components/BevProLogo";
import { motion } from "framer-motion";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
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
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData) => {
    setServerError(null);
    login.mutate(data, {
      onSuccess: () => {
        setLocation("/dashboard");
      },
      onError: (error: Error) => {
        setServerError(error.message.includes("401") ? "Invalid email or password" : "Something went wrong. Please try again.");
      },
    });
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{ backgroundImage: "url('/login-bg.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60" />

      <div className="relative z-10 min-h-screen flex">
        <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-8 sm:py-12 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link href="/" className="inline-flex items-center gap-2.5 mb-8 sm:mb-12" data-testid="link-home">
              <BevProLogo size={32} />
              <BevProWordmark className="text-xl text-white" />
            </Link>

            <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight mb-2" data-testid="text-login-title">
              Welcome back
            </h1>
            <p className="text-white/50 text-sm sm:text-base mb-8 sm:mb-10">
              Sign in to manage your venue's voice agents
            </p>

            {serverError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                data-testid="text-login-error"
                className="flex items-center gap-2.5 p-4 rounded-lg bg-red-500/10 border border-red-500/15 text-red-400 text-base mb-6"
              >
                <AlertCircle size={16} className="shrink-0" />
                {serverError}
              </motion.div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label htmlFor="email" className="text-xs uppercase tracking-[0.15em] text-white/50 font-medium block mb-2">Email</label>
                <input
                  id="email"
                  type="email"
                  data-testid="input-email"
                  placeholder="you@venue.com"
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
                  type="password"
                  data-testid="input-password"
                  placeholder="••••••••"
                  className="w-full bg-white/[0.04] border-0 border-b border-white/10 rounded-none px-0 py-4 text-base text-white placeholder:text-white/30 focus:outline-none focus:border-[#C9A96E]/50 transition-colors"
                  {...register("password")}
                />
                {errors.password && (
                  <p data-testid="text-password-error" className="text-red-400 text-sm mt-2">{errors.password.message}</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  data-testid="button-login"
                  disabled={login.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-[#C9A96E] text-black py-4 text-base font-semibold tracking-wide uppercase hover:bg-[#D4B87A] disabled:opacity-50 transition-all duration-300"
                >
                  {login.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>

            {authConfig?.googleEnabled && (
              <>
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-white/8" />
                  <span className="text-[11px] text-white/25 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>
                <a
                  href="/api/auth/google"
                  data-testid="button-google-login"
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

            <p className="mt-10 text-base text-white/40">
              Don't have an account?{" "}
              <Link href="/register" data-testid="link-register" className="text-white/60 hover:text-white transition-colors">
                Create one
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
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#C9A96E]/80 font-medium">Brighton Abbey</span>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                Glass chapel, crystal chandeliers, and seamless voice-powered service — all from a single earbud.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
