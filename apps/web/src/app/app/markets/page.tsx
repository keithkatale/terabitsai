import { redirect } from "next/navigation";
import { APP_BASE } from "@/lib/routes";

export default function RemovedMarketsPage() {
  redirect(`${APP_BASE}/home`);
}
