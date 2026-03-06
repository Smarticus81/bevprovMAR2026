import { motion } from "framer-motion";

interface BevProLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
  pulseIntensity?: number;
}

export function BevProLogo({ size = 32, className = "", animated = false, pulseIntensity = 1 }: BevProLogoProps) {
  const bars = [
    { height: 0.35, delay: 0 },
    { height: 0.55, delay: 0.1 },
    { height: 0.85, delay: 0.15 },
    { height: 1, delay: 0.2 },
    { height: 0.7, delay: 0.25 },
    { height: 0.45, delay: 0.3 },
    { height: 0.25, delay: 0.35 },
  ];

  const barWidth = size * 0.08;
  const gap = size * 0.045;
  const totalBarsWidth = bars.length * barWidth + (bars.length - 1) * gap;
  const startX = (size - totalBarsWidth) / 2;
  const maxBarHeight = size * 0.6;
  const centerY = size * 0.5;

  if (animated) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        className={className}
        data-testid="bevpro-logo"
      >
        {bars.map((bar, i) => {
          const x = startX + i * (barWidth + gap);
          const baseH = bar.height * maxBarHeight;
          const animatedH = baseH * pulseIntensity;
          return (
            <motion.rect
              key={i}
              x={x}
              rx={barWidth / 2}
              width={barWidth}
              fill="currentColor"
              animate={{
                height: [baseH * 0.4, animatedH, baseH * 0.4],
                y: [centerY - (baseH * 0.4) / 2, centerY - animatedH / 2, centerY - (baseH * 0.4) / 2],
              }}
              transition={{
                duration: 1.2 + bar.delay * 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: bar.delay,
              }}
            />
          );
        })}
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      className={className}
      data-testid="bevpro-logo"
    >
      {bars.map((bar, i) => {
        const x = startX + i * (barWidth + gap);
        const h = bar.height * maxBarHeight;
        return (
          <rect
            key={i}
            x={x}
            y={centerY - h / 2}
            rx={barWidth / 2}
            width={barWidth}
            height={h}
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}

export function BevProWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      BevPro
    </span>
  );
}

export function BevProBrand({ size = 28, className = "", gap = "gap-2" }: { size?: number; className?: string; gap?: string }) {
  return (
    <div className={`flex items-center ${gap} ${className}`} data-testid="bevpro-brand">
      <BevProLogo size={size} className="text-white" />
      <BevProWordmark className="text-white text-xl" />
    </div>
  );
}
