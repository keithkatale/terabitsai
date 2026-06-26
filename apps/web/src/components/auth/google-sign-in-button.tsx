"use client";

import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useState } from "react";
import { signInWithGoogleIdToken } from "@/lib/auth/sign-in-with-google";
import { getPostAuthPath } from "@/lib/auth/post-auth";
import { readGoogleClientId } from "@/lib/auth/google-config";

type GoogleSignInButtonProps = {
  mode: "signin" | "signup";
  /** Current window search string, e.g. `?next=/chat/markets` */
  search: string;
};

export function GoogleSignInButton({ mode, search }: GoogleSignInButtonProps) {
  const clientId = readGoogleClientId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!clientId) return null;

  const onSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      setError("Google did not return a sign-in credential.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await signInWithGoogleIdToken(response.credential);
      window.location.href = getPostAuthPath(search);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Google sign-in could not be completed.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div
        className={`flex justify-center ${loading ? "pointer-events-none opacity-60" : ""}`}
        aria-busy={loading}
      >
        <GoogleLogin
          onSuccess={onSuccess}
          onError={() => {
            setError("Google sign-in was cancelled or failed.");
          }}
          theme="filled_black"
          size="large"
          width="384"
          text={mode === "signup" ? "signup_with" : "signin_with"}
          shape="rectangular"
        />
      </div>
      {error ? <p className="text-sm text-red-400 font-medium text-center">{error}</p> : null}
    </div>
  );
}
