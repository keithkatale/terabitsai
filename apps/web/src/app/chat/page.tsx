import { redirect } from "next/navigation";
import { APP_BASE } from "@/lib/routes";

export default function ChatAppRootPage() {
  redirect(`${APP_BASE}/markets`);
}
