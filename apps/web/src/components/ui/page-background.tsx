import { cn } from "@/lib/utils";

export function PageBackground({
  className,
  overlay = "medium",
}: {
  className?: string;
  overlay?: "minimal" | "light" | "medium" | "heavy";
}) {
  const overlayClass =
    overlay === "minimal"
      ? "bg-gradient-to-b from-black/20 via-black/10 to-black/28"
      : overlay === "light"
        ? "bg-gradient-to-b from-black/30 via-black/18 to-black/38"
        : overlay === "heavy"
          ? "bg-gradient-to-b from-black/55 via-black/42 to-black/62"
          : "bg-gradient-to-b from-black/38 via-black/24 to-black/45";

  return (
    <div className={cn("pointer-events-none fixed inset-0 -z-10", className)} aria-hidden>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/Background.png')" }}
      />
      <div className={cn("absolute inset-0", overlayClass)} />
    </div>
  );
}
