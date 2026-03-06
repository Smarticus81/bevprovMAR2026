import { motion } from "framer-motion";

interface BevProLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
  pulseIntensity?: number;
}

export function BevProLogo({ size = 32, className = "", animated = false, pulseIntensity = 1 }: BevProLogoProps) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.42;
  const strokeW = s * 0.055;
  const innerR = r * 0.52;

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
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="currentColor"
          strokeWidth={strokeW}
          fill="none"
          animate={{ scale: [1, 1.03 * pulseIntensity, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.path
          d={`M ${cx - innerR * 0.55} ${cy - innerR * 0.7}
              Q ${cx - innerR * 0.55} ${cy + innerR * 0.85}, ${cx + innerR * 0.1} ${cy + innerR * 0.85}
              Q ${cx + innerR * 0.7} ${cy + innerR * 0.85}, ${cx + innerR * 0.7} ${cy + innerR * 0.2}
              Q ${cx + innerR * 0.7} ${cy - innerR * 0.3}, ${cx + innerR * 0.1} ${cy - innerR * 0.15}
              M ${cx - innerR * 0.55} ${cy - innerR * 0.15}
              L ${cx + innerR * 0.45} ${cy - innerR * 0.15}
              Q ${cx + innerR * 0.7} ${cy - innerR * 0.15}, ${cx + innerR * 0.7} ${cy - innerR * 0.5}
              Q ${cx + innerR * 0.7} ${cy - innerR * 0.85}, ${cx + innerR * 0.1} ${cy - innerR * 0.7}
              L ${cx - innerR * 0.55} ${cy - innerR * 0.7}
              Z`}
          stroke="currentColor"
          strokeWidth={strokeW * 0.7}
          fill="currentColor"
          fillOpacity={0.15}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        />

        {[0.62, 0.78, 0.95].map((scale, i) => (
          <motion.path
            key={i}
            d={`M ${cx + innerR * 0.85} ${cy - r * scale * 0.3}
                A ${r * scale * 0.4} ${r * scale * 0.4} 0 0 1 ${cx + innerR * 0.85} ${cy + r * scale * 0.3}`}
            stroke="currentColor"
            strokeWidth={strokeW * 0.45}
            strokeLinecap="round"
            fill="none"
            animate={{
              opacity: [0, 0.8 * pulseIntensity, 0],
              pathLength: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.25,
            }}
          />
        ))}
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
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="currentColor"
        strokeWidth={strokeW}
        fill="none"
        opacity={0.8}
      />

      <path
        d={`M ${cx - innerR * 0.55} ${cy - innerR * 0.7}
            Q ${cx - innerR * 0.55} ${cy + innerR * 0.85}, ${cx + innerR * 0.1} ${cy + innerR * 0.85}
            Q ${cx + innerR * 0.7} ${cy + innerR * 0.85}, ${cx + innerR * 0.7} ${cy + innerR * 0.2}
            Q ${cx + innerR * 0.7} ${cy - innerR * 0.3}, ${cx + innerR * 0.1} ${cy - innerR * 0.15}
            M ${cx - innerR * 0.55} ${cy - innerR * 0.15}
            L ${cx + innerR * 0.45} ${cy - innerR * 0.15}
            Q ${cx + innerR * 0.7} ${cy - innerR * 0.15}, ${cx + innerR * 0.7} ${cy - innerR * 0.5}
            Q ${cx + innerR * 0.7} ${cy - innerR * 0.85}, ${cx + innerR * 0.1} ${cy - innerR * 0.7}
            L ${cx - innerR * 0.55} ${cy - innerR * 0.7}
            Z`}
        stroke="currentColor"
        strokeWidth={strokeW * 0.7}
        fill="currentColor"
        fillOpacity={0.1}
      />

      {[0.62, 0.78, 0.95].map((scale, i) => (
        <path
          key={i}
          d={`M ${cx + innerR * 0.85} ${cy - r * scale * 0.3}
              A ${r * scale * 0.4} ${r * scale * 0.4} 0 0 1 ${cx + innerR * 0.85} ${cy + r * scale * 0.3}`}
          stroke="currentColor"
          strokeWidth={strokeW * 0.45}
          strokeLinecap="round"
          fill="none"
          opacity={0.4 + i * 0.15}
        />
      ))}
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
