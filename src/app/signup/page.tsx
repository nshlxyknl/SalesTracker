"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Loader2, Eye, EyeOff, Check, X } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  // Password validation
  const passwordChecks = {
    length: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /\d/.test(password),
  };

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  // Username validation
  const usernameChecks = {
    length: username.length >= 3,
    format: /^[a-zA-Z0-9_]+$/.test(username),
  };

  const isUsernameValid = Object.values(usernameChecks).every(Boolean);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate inputs
      if (!username || !password) {
        setError("Username and password are required.");
        setLoading(false);
        return;
      }

      if (!isUsernameValid) {
        setError("Please fix the username requirements.");
        setLoading(false);
        return;
      }

      if (!isPasswordValid) {
        setError("Please fix the password requirements.");
        setLoading(false);
        return;
      }

      const result = await signUp(username, password);

      if (!result.success) {
        setError(result.error || "Signup failed");
        setLoading(false);
      } else {
        // Refresh the session context
        await refresh();
        
        // New users get 'user' role by default, redirect to user dashboard
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      console.error("Signup error:", error);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
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
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
                {username && (
                  <div className="space-y-1 text-xs">
                    <div className={`flex items-center gap-1 ${usernameChecks.length ? 'text-green-600' : 'text-gray-400'}`}>
                      {usernameChecks.length ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      At least 3 characters
                    </div>
                    <div className={`flex items-center gap-1 ${usernameChecks.format ? 'text-green-600' : 'text-gray-400'}`}>
                      {usernameChecks.format ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      Letters, numbers and underscores only
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="space-y-1 text-xs">
                    <div className={`flex items-center gap-1 ${passwordChecks.length ? 'text-green-600' : 'text-gray-400'}`}>
                      {passwordChecks.length ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      At least 8 characters
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.hasLetter ? 'text-green-600' : 'text-gray-400'}`}>
                      {passwordChecks.hasLetter ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      Contains a letter
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                      {passwordChecks.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      Contains a number
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                disabled={loading || !isUsernameValid || !isPasswordValid} 
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
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
