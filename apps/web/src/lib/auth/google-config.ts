/** GCP OAuth 2.0 Web client ID (Google Cloud Console → Credentials). */
export function readGoogleClientId(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
}
