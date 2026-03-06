import { motion } from "framer-motion";

interface BevProLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
  pulseIntensity?: number;
}

const GOLD = "#C9A96E";
const GOLD_LIGHT = "#D4B87A";

export function BevProLogo({ size = 32, className = "", animated = false, pulseIntensity = 1 }: BevProLogoProps) {
  if (animated) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        className={className}
        data-testid="bevpro-logo"
      >
        <defs>
          <linearGradient id={`gold-grad-anim-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={GOLD_LIGHT} />
            <stop offset="100%" stopColor={GOLD} />
          </linearGradient>
        </defs>
        <motion.rect
          x="18" y="30" width="38" height="10" rx="5"
          fill={`url(#gold-grad-anim-${size})`}
          animate={{
            width: [38, 38 + 8 * pulseIntensity, 38],
            x: [18, 18 - 4 * pulseIntensity, 18],
            opacity: [0.85, 1, 0.85],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.rect
          x="18" y="47" width="56" height="10" rx="5"
          fill={`url(#gold-grad-anim-${size})`}
          animate={{
            width: [56, 56 + 6 * pulseIntensity, 56],
            opacity: [0.85, 1, 0.85],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
        />
        <motion.rect
          x="18" y="64" width="44" height="10" rx="5"
          fill={`url(#gold-grad-anim-${size})`}
          animate={{
            width: [44, 44 + 10 * pulseIntensity, 44],
            x: [18, 18 - 2 * pulseIntensity, 18],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      data-testid="bevpro-logo"
    >
      <defs>
        <linearGradient id={`gold-grad-${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GOLD_LIGHT} />
          <stop offset="100%" stopColor={GOLD} />
        </linearGradient>
      </defs>
      <rect x="18" y="30" width="38" height="10" rx="5" fill={`url(#gold-grad-${size})`} />
      <rect x="18" y="47" width="56" height="10" rx="5" fill={`url(#gold-grad-${size})`} />
      <rect x="18" y="64" width="44" height="10" rx="5" fill={`url(#gold-grad-${size})`} />
    </svg>
  );
}

export function BevProWordmark({ className = "", size = "text-xl" }: { className?: string; size?: string }) {
  return (
    <span
      className={`${size} ${className}`}
      style={{
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 600,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
      }}
    >
      BEVPRO
    </span>
  );
}

export function BevProBrand({ size = 28, className = "", gap = "gap-2.5", textSize = "text-xl" }: { size?: number; className?: string; gap?: string; textSize?: string }) {
  return (
    <div className={`flex items-center ${gap} ${className}`} data-testid="bevpro-brand">
      <BevProLogo size={size} />
      <BevProWordmark className="text-white" size={textSize} />
    </div>
  );
}
