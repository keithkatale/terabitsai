function stripTrailingSlash(u: string): string {
  return u.replace(/\/$/, "");
}

export function appBaseUrl(): string {
  const explicit = process.env.APP_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
