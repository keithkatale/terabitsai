/** Figma "BLUE HUE" background — conic arcs + screen-blended blooms. */
export function LandingBlueGlow({
  className = "",
  variant = "hero",
}: {
  className?: string;
  variant?: "hero" | "footer";
}) {
  return (
    <div
      className={`landing-blue-glow landing-blue-glow--${variant} pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <div className="landing-blue-conic landing-blue-conic--left" />
      <div className="landing-blue-conic landing-blue-conic--right" />
      <div className="landing-blue-bloom landing-blue-bloom--primary" />
      <div className="landing-blue-bloom landing-blue-bloom--secondary" />
      {variant === "footer" ? <div className="landing-blue-ellipse" /> : null}
    </div>
  );
}
