/** Authenticated app shell lives under /chat (not /app). */
export const APP_BASE = "/app";

export const CHAT_DRAFT_SEGMENT = "new";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isConversationIdSegment(segment: string): boolean {
  return UUID_RE.test(segment);
}

export function chatConversationPath(conversationId: string): string {
  return `${APP_BASE}/${conversationId}`;
}

export function chatDraftPath(): string {
  return `${APP_BASE}/${CHAT_DRAFT_SEGMENT}`;
}
