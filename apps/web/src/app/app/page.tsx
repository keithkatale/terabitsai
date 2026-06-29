import { redirect } from "next/navigation";
import { APP_BASE } from "@/lib/routes";

export default function AppRootPage() {
  redirect(`${APP_BASE}/home`);
}
