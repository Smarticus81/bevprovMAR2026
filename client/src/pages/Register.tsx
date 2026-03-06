import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertCircle, Check } from "lucide-react";
import { BevProLogo, BevProWordmark } from "@/components/BevProLogo";

const PLANS = [
  { id: "starter", name: "Starter", price: "$49/mo" },
  { id: "pro", name: "Pro", price: "$149/mo" },
  { id: "enterprise", name: "Enterprise", price: "Custom" },
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
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3" data-testid="link-home">
            <BevProLogo size={40} className="text-white/60" />
            <BevProWordmark className="text-2xl text-white" />
          </Link>
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-white" data-testid="text-register-title">Create your account</CardTitle>
            <CardDescription className="text-white/50">Set up your venue and start building voice agents</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <div data-testid="text-register-error" className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {serverError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="venueName" className="text-white/70">Venue Name</Label>
                <Input
                  id="venueName"
                  type="text"
                  data-testid="input-venue-name"
                  placeholder="The Grand Ballroom"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                  {...register("venueName")}
                />
                {errors.venueName && (
                  <p data-testid="text-venue-error" className="text-red-400 text-xs">{errors.venueName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-white/70">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  data-testid="input-name"
                  placeholder="Jane Smith"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                  {...register("name")}
                />
                {errors.name && (
                  <p data-testid="text-name-error" className="text-red-400 text-xs">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/70">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="input-email"
                  placeholder="jane@venue.com"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                  {...register("email")}
                />
                {errors.email && (
                  <p data-testid="text-email-error" className="text-red-400 text-xs">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/70">Password</Label>
                <Input
                  id="password"
                  type="password"
                  data-testid="input-password"
                  placeholder="••••••••"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-white/30"
                  {...register("password")}
                />
                {errors.password && (
                  <p data-testid="text-password-error" className="text-red-400 text-xs">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Plan</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      data-testid={`button-plan-${plan.id}`}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative p-3 rounded-lg border text-center transition-all duration-200 ${
                        selectedPlan === plan.id
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/20"
                      }`}
                    >
                      {selectedPlan === plan.id && (
                        <div className="absolute top-1.5 right-1.5">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                      <div className="text-sm font-medium">{plan.name}</div>
                      <div className="text-xs mt-0.5 opacity-70">{plan.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                data-testid="button-register"
                disabled={registerUser.isPending}
                className="w-full bg-white text-black hover:bg-white/90 border-none"
              >
                {registerUser.isPending ? <Loader2 size={16} className="animate-spin" /> : "Create Account"}
              </Button>
            </form>

            {authConfig?.googleEnabled && (
              <>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-white/30">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <a
                  href="/api/auth/google"
                  data-testid="button-google-register"
                  className="flex items-center justify-center gap-3 w-full border border-white/20 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-white hover:text-black transition-all duration-300"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </a>
              </>
            )}

            <div className="mt-6 text-center text-sm text-white/50">
              Already have an account?{" "}
              <Link href="/login" data-testid="link-login" className="text-white hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
