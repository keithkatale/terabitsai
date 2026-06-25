import Image from "next/image";
import { cn } from "@/lib/utils";

export const APP_LOGO_SRC = "/benchmark.png";

const sizeConfig = {
  sm: { box: "h-7 w-7 rounded-[10px]", px: 28, word: "text-sm" },
  md: { box: "h-9 w-9 rounded-[12px]", px: 36, word: "text-base" },
  lg: { box: "h-14 w-14 rounded-[18px]", px: 56, word: "text-2xl" },
} as const;

export function BrandLogoIcon({
  size = "md",
  className,
}: {
  size?: keyof typeof sizeConfig;
  className?: string;
}) {
  const config = sizeConfig[size];

  return (
    <div
      className={cn(
        config.box,
        "relative shrink-0 overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
    >
      <Image
        src={APP_LOGO_SRC}
        alt="Terabits AI"
        width={config.px}
        height={config.px}
        className="h-full w-full object-cover"
        priority={size === "lg"}
      />
    </div>
  );
}

export function BrandMark({
  size = "md",
  className,
  showWordmark = true,
}: {
  size?: keyof typeof sizeConfig;
  className?: string;
  showWordmark?: boolean;
}) {
  const config = sizeConfig[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandLogoIcon size={size} />
      {showWordmark ? (
        <span className={cn("font-extrabold text-white tracking-tight", config.word)}>
          Terabits AI
        </span>
      ) : null}
    </div>
  );
}
