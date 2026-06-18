"use client";

import Link from "next/link";
import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        window.location.href = "/";
        return;
      }

      setCheckEmail(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create account."
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkEmail) {
    return (
      <div className="min-h-screen bg-[#050508] text-zinc-200 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-zinc-950/80 border border-zinc-900 rounded-2xl p-8 text-center">
          <h1 className="text-xl font-extrabold text-white mb-2">
            Check your email
          </h1>
          <p className="text-sm text-zinc-500">
            We sent a confirmation link to <strong className="text-zinc-300">{email}</strong>.
            Click it to activate your Terabits AI account.
          </p>
          <Link
            href="/login"
            className="inline-block mt-6 text-sm text-indigo-400 font-semibold hover:text-indigo-300"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-zinc-200 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center">
            <SparklesIcon className="size-5 text-white" />
          </div>
          <span className="text-xl font-extrabold text-white">Terabits AI</span>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-900 rounded-2xl p-8">
          <h1 className="text-2xl font-extrabold text-white mb-1">
            Create your account
          </h1>
          <p className="text-sm text-zinc-500 mb-6">
            Get a demo wallet and start paper trading with AI-powered analysis.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none text-white"
              />
              <p className="mt-1 text-[10px] text-zinc-600">At least 8 characters</p>
            </div>

            {error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-extrabold text-sm rounded-xl disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-400 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
