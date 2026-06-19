"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PageBackground } from "@/components/ui/page-background";
import { BrandMark } from "@/components/ui/brand-mark";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "auth_callback_failed") {
      setError("Sign-in could not be completed. Please try again.");
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      const next =
        new URLSearchParams(window.location.search).get("next") || "/";
      window.location.href = next;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not sign in. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen text-zinc-200 flex items-center justify-center p-6">
      <PageBackground overlay="medium" />

      <div className="w-full max-w-md relative">
        <div className="flex justify-center mb-8">
          <BrandMark />
        </div>

        <div className="terminal-card rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-extrabold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-zinc-400 mb-6">
            Sign in to access Terabits AI. New users start on the free chat plan.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full neo-input px-4 py-2.5 text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full neo-input px-4 py-2.5 text-sm"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p className="text-sm text-red-400 font-medium">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="terminal-btn terminal-btn-primary w-full py-3 text-sm disabled:opacity-70 flex items-center justify-center min-h-[44px]"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-label="Signing in" />
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            No account?{" "}
            <Link
              href="/signup"
              className="text-blue-400 font-semibold hover:text-blue-300"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
