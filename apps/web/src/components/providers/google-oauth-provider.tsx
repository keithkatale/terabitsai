"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import type { ReactNode } from "react";
import { readGoogleClientId } from "@/lib/auth/google-config";

export function GoogleOAuthProviderWrapper({ children }: { children: ReactNode }) {
  const clientId = readGoogleClientId();
  if (!clientId) return <>{children}</>;
  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>;
}
