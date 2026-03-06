import { motion } from "framer-motion";

interface BevProLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
  pulseIntensity?: number;
  goldColor?: string;
}

export function BevProLogo({ size = 32, className = "", animated = false, pulseIntensity = 1, goldColor = "#C9A96E" }: BevProLogoProps) {
  const s = size;
  const barW = s * 0.7;
  const shortBarW = s * 0.5;
  const barH = s * 0.15;
  const barR = barH / 2;
  const gap = s * 0.12;
  const cx = s / 2;
  const topY = cx - gap / 2 - barH;
  const botY = cx + gap / 2;

  if (animated) {
    return (
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        fill="none"
        className={className}
        data-testid="bevpro-logo"
      >
        <motion.rect
          x={cx - shortBarW / 2}
          y={topY}
          width={shortBarW}
          height={barH}
          rx={barR}
          fill={goldColor}
          animate={{
            width: [shortBarW, shortBarW * (1 + 0.15 * pulseIntensity), shortBarW],
            x: [cx - shortBarW / 2, cx - shortBarW * (1 + 0.15 * pulseIntensity) / 2, cx - shortBarW / 2],
          }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.rect
          x={cx - barW / 2}
          y={botY}
          width={barW}
          height={barH}
          rx={barR}
          fill={goldColor}
          animate={{
            width: [barW, barW * (1 + 0.1 * pulseIntensity), barW],
            x: [cx - barW / 2, cx - barW * (1 + 0.1 * pulseIntensity) / 2, cx - barW / 2],
          }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        />
      </svg>
    );
  }

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      className={className}
      data-testid="bevpro-logo"
    >
      <rect
        x={cx - shortBarW / 2}
        y={topY}
        width={shortBarW}
        height={barH}
        rx={barR}
        fill={goldColor}
      />
      <rect
        x={cx - barW / 2}
        y={botY}
        width={barW}
        height={barH}
        rx={barR}
        fill={goldColor}
      />
    </svg>
  );
}

export function BevProWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-light tracking-wide lowercase ${className}`}>
      bevpro
    </span>
  );
}

export function BevProBrand({ size = 28, className = "", gap = "gap-2" }: { size?: number; className?: string; gap?: string }) {
  return (
    <div className={`flex items-center ${gap} ${className}`} data-testid="bevpro-brand">
      <BevProLogo size={size} />
      <BevProWordmark className="text-white text-xl" />
    </div>
  );
}
