"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getPostAuthPath,
  isExistingUserSignUp,
  isUserAlreadyRegisteredError,
} from "@/lib/auth/post-auth";
import { PageBackground } from "@/components/ui/page-background";
import { BrandMark } from "@/components/ui/brand-mark";
import { AuthMethodDivider } from "@/components/auth/auth-method-divider";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loginHref, setLoginHref] = useState("/login");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch(window.location.search);
    const next = new URLSearchParams(window.location.search).get("next");
    setLoginHref(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const postAuthPath = getPostAuthPath(window.location.search);
    const trimmedEmail = email.trim();

    try {
      const supabase = createSupabaseBrowserClient();

      const signInExisting = async () => {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInError) throw signInError;
        window.location.href = postAuthPath;
      };

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(postAuthPath)}`,
        },
      });

      if (data.session) {
        window.location.href = postAuthPath;
        return;
      }

      const existingAccount =
        (signUpError && isUserAlreadyRegisteredError(signUpError)) ||
        isExistingUserSignUp(data);

      if (existingAccount) {
        await signInExisting();
        return;
      }

      if (signUpError) throw signUpError;

      setCheckEmail(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create account.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkEmail) {
    return (
      <div className="relative min-h-screen text-zinc-200 flex items-center justify-center p-6">
        <PageBackground overlay="medium" />
        <div className="w-full max-w-md terminal-card rounded-2xl p-8 text-center relative">
          <h1 className="text-xl font-extrabold text-white mb-2">
            Check your email
          </h1>
          <p className="text-sm text-zinc-400">
            We sent a confirmation link to <strong className="text-zinc-300">{email}</strong>.
            Click it to activate your Terabits AI account.
          </p>
          <Link
            href={loginHref}
            className="inline-block mt-6 text-sm text-blue-400 font-semibold hover:text-blue-300"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-zinc-200 flex items-center justify-center p-6">
      <PageBackground overlay="medium" />

      <div className="w-full max-w-md relative">
        <div className="flex justify-center mb-8">
          <BrandMark />
        </div>

        <div className="terminal-card rounded-2xl p-8">
          <h1 className="text-2xl font-extrabold text-white mb-1">
            Create your account
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            Get a demo wallet and start paper trading with AI-powered analysis.
          </p>

          <GoogleSignInButton mode="signup" search={search} />
          <AuthMethodDivider />

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
                className="mt-1.5 w-full neo-input px-4 py-2.5 text-sm"
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
                className="mt-1.5 w-full neo-input px-4 py-2.5 text-sm"
              />
              <p className="mt-1 text-[10px] text-zinc-600">At least 8 characters</p>
            </div>

            {error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="terminal-btn terminal-btn-primary w-full py-3 text-sm disabled:opacity-70 flex items-center justify-center min-h-[44px]"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-label="Creating account" />
              ) : (
                "Sign up"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href={loginHref} className="text-blue-400 font-semibold hover:text-blue-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
