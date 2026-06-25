import { redirect } from "next/navigation";
import { APP_BASE, chatDraftPath } from "@/lib/routes";

export default function LegacyAppPage() {
  redirect(`${APP_BASE}/markets`);
}
