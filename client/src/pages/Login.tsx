import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-semibold tracking-tight" data-testid="link-home">
            BevPro
          </Link>
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-white" data-testid="text-login-title">Sign in to your account</CardTitle>
            <CardDescription className="text-white/50">Enter your credentials to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <div data-testid="text-login-error" className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {serverError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/70">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="input-email"
                  placeholder="you@venue.com"
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

              <Button
                type="submit"
                data-testid="button-login"
                disabled={login.isPending}
                className="w-full bg-white text-black hover:bg-white/90 border-none"
              >
                {login.isPending ? <Loader2 size={16} className="animate-spin" /> : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-white/50">
              Don't have an account?{" "}
              <Link href="/register" data-testid="link-register" className="text-white hover:underline">
                Create one
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
