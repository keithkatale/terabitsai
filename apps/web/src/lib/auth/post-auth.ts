import type { AuthError, Session, User } from "@supabase/supabase-js";

/** Default destination after sign-in / sign-up. Honors a safe relative `next` query param. */
export function getPostAuthPath(search: string): string {
  const next = new URLSearchParams(search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/app/chat";
}

/** Supabase returns an empty identities array when the email is already registered. */
export function isExistingUserSignUp(data: {
  user: User | null;
  session: Session | null;
}): boolean {
  return Boolean(data.user && !data.session && data.user.identities?.length === 0);
}

export function isUserAlreadyRegisteredError(error: AuthError | Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already exists")
  );
}
