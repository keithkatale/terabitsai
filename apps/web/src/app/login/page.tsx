"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
    <div className="min-h-screen bg-[#050508] text-zinc-200 flex items-center justify-center p-6">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[300px] bg-gradient-to-b from-indigo-950/20 via-transparent to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <SparklesIcon className="size-5 text-white" />
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight">
            Terabits AI
          </span>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-900 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <h1 className="text-2xl font-extrabold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-zinc-500 mb-6">
            Sign in to access your trading workspace and demo wallet.
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
                className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm outline-none text-white"
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
                className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm outline-none text-white"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p className="text-sm text-red-400 font-medium">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-extrabold text-sm rounded-xl hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            No account?{" "}
            <Link
              href="/signup"
              className="text-indigo-400 font-semibold hover:text-indigo-300"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
