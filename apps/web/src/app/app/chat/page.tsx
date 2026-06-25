import { redirect } from "next/navigation";
import { chatDraftPath } from "@/lib/routes";

export default function LegacyChatPage() {
  redirect(chatDraftPath());
}
