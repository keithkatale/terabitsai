import { redirect } from "next/navigation";

export default async function LegacyAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
