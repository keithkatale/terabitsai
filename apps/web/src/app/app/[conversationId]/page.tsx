import { redirect } from "next/navigation";
import { chatDraftPath, isConversationIdSegment } from "@/lib/routes";

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  if (!isConversationIdSegment(conversationId)) {
    redirect(chatDraftPath());
  }
  return null;
}
