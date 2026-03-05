import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertCircle, Check } from "lucide-react";

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
          <Link href="/" className="text-2xl font-semibold tracking-tight" data-testid="link-home">
            BevPro
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
