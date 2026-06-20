import { cn } from "@/lib/utils";

export function PageBackground({
  className,
  overlay = "medium",
  variant = "default",
}: {
  className?: string;
  overlay?: "minimal" | "light" | "medium" | "heavy";
  variant?: "default" | "orb";
}) {
  const overlayClass =
    overlay === "minimal"
      ? "from-[var(--background)]/25 via-transparent to-[var(--background)]/35"
      : overlay === "light"
        ? "from-[var(--background)]/40 via-transparent to-[var(--background)]/50"
        : overlay === "heavy"
          ? "from-[var(--background)]/60 via-[var(--background)]/40 to-[var(--background)]/70"
          : "from-[var(--background)]/45 via-transparent to-[var(--background)]/55";

  return (
    <div
      className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--background)]", className)}
      aria-hidden
    >
      {variant === "orb" ? (
        <>
          <div className="landing-ambient-orb" />
          <div className="landing-ambient-orb-glare" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_50%_44%,transparent_30%,var(--background)_72%)]" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(59,130,246,0.06)_0%,transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(59,130,246,0.03)_0%,transparent_50%)]" />
        </>
      )}
      <div className={cn("absolute inset-0 bg-gradient-to-b", overlayClass)} />
    </div>
  );
}
