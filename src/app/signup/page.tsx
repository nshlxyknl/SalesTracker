"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Loader2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const username = (fd.get("username") as string).toLowerCase().trim();
    const password = fd.get("password") as string;
    const internalEmail = `${username}@internal.local`;

    const res = await signUp.email({
      name: username,
      email: internalEmail,
      password,
      // @ts-expect-error — better-auth additionalFields
      username,
    });

    setLoading(false);
    if (res.error) {
      setError(res.error.message ?? "Something went wrong.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-900 rounded-xl mb-4">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Tracker</h1>
          <p className="text-gray-500 mt-1 text-sm">Create your account</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Get started</CardTitle>
            <CardDescription>Choose a username and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="johndoe"
                  autoComplete="username"
                  pattern="[a-zA-Z0-9_]+"
                  title="Letters, numbers and underscores only"
                />
                <p className="text-gray-400 text-xs">Letters, numbers and underscores only</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : "Create Account"}
              </Button>
            </form>

            <p className="text-center text-gray-500 text-sm mt-5">
              Already have an account?{" "}
              <Link href="/login" className="text-gray-900 font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
