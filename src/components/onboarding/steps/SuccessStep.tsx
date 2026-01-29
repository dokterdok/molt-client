import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "../../../lib/utils";

interface SuccessStepProps {
  onNext: () => void;
  onSkip: () => void;
}

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  scale: number;
}

export function SuccessStep({ onNext, onSkip }: SuccessStepProps) {
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus primary button
    primaryButtonRef.current?.focus();

    // Generate confetti particles with better randomization
    const colors = [
      "#f97316",
      "#ef4444",
      "#ec4899",
      "#a855f7",
      "#3b82f6",
      "#10b981",
    ];
    const particles: ConfettiParticle[] = Array.from(
      { length: 50 },
      (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10,
        rotation: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
        scale: 0.5 + Math.random() * 0.5,
      }),
    );
    setConfetti(particles);

    // Auto-advance (Enter → start using, skip the tour)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        document.activeElement === primaryButtonRef.current
      ) {
        e.preventDefault();
        onSkip(); // Skip tour, go straight to app
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSkip]);

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden"
      role="main"
      aria-labelledby="success-heading"
    >
      {/* Confetti with framer-motion for 60fps animations */}
      {confetti.map((particle, index) => (
        <motion.div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full pointer-events-none"
          initial={{
            x: `${particle.x}vw`,
            y: particle.y,
            rotate: 0,
            opacity: 1,
            scale: particle.scale,
          }}
          animate={{
            y: "110vh",
            rotate: particle.rotation * 3,
            opacity: [1, 1, 0.8, 0],
            x: `${particle.x + (Math.random() - 0.5) * 20}vw`,
          }}
          transition={{
            duration: 2.5 + Math.random() * 1,
            delay: index * 0.02,
            ease: [0.45, 0.05, 0.55, 0.95],
          }}
          style={{
            backgroundColor: particle.color,
          }}
          aria-hidden="true"
        />
      ))}

      <div className="max-w-2xl w-full text-center space-y-8 relative z-10">
        {/* Celebration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 32 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-2xl shadow-green-500/40 mb-8"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{
              duration: 0.6,
              times: [0, 0.6, 1],
              ease: [0.34, 1.56, 0.64, 1], // Bouncy easing
            }}
            aria-label="Success celebration"
          >
            <motion.span
              className="text-7xl"
              animate={{
                rotate: [0, -15, 15, -15, 15, 0],
                scale: [1, 1.1, 1, 1.1, 1],
              }}
              transition={{
                duration: 1,
                delay: 0.3,
                ease: "easeInOut",
              }}
              role="img"
              aria-label="Party popper emoji"
            >
              🎉
            </motion.span>
          </motion.div>
          <motion.h2
            id="success-heading"
            className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            You're All Set!
          </motion.h2>
          <motion.p
            className="text-xl text-muted-foreground max-w-lg mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Moltz is connected and ready to help you get things done.
          </motion.p>
        </motion.div>

        {/* Quick wins */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto"
          role="list"
          aria-label="Key benefits"
        >
          {[
            {
              icon: "⚡",
              title: "Lightning Fast",
              desc: "Your data stays local. No cloud delays.",
              gradient: "from-orange-500/10 to-red-500/10",
              border: "border-orange-500/20",
            },
            {
              icon: "🔐",
              title: "Totally Private",
              desc: "Everything runs on your machine.",
              gradient: "from-purple-500/10 to-pink-500/10",
              border: "border-purple-500/20",
            },
          ].map((benefit, index) => (
            <motion.div
              key={benefit.title}
              role="listitem"
              initial={{ opacity: 0, y: 32, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.4 + index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={{
                scale: 1.05,
                transition: { type: "spring", stiffness: 400, damping: 25 },
              }}
              className={cn(
                "p-5 rounded-xl bg-gradient-to-br border text-left",
                benefit.gradient,
                benefit.border,
              )}
            >
              <div
                className="text-2xl mb-2"
                role="img"
                aria-label={benefit.title}
              >
                {benefit.icon}
              </div>
              <h3 className="font-semibold mb-1">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.button
            ref={primaryButtonRef}
            onClick={onSkip}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="group px-8 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold text-lg shadow-xl shadow-green-500/30 hover:shadow-2xl hover:shadow-green-500/40 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Start using Moltz"
          >
            <span className="flex items-center gap-2">
              Start Using Moltz
              <motion.svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                initial={{ x: 0 }}
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </motion.svg>
            </span>
          </motion.button>

          <motion.button
            onClick={onNext}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-muted focus:ring-offset-2 focus:ring-offset-background rounded px-3 py-1"
            aria-label="View keyboard shortcuts before starting"
          >
            Show me keyboard shortcuts first
          </motion.button>
        </motion.div>

        {/* Keyboard hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-xs text-muted-foreground"
        >
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Enter</kbd>{" "}
          to continue
        </motion.p>
      </div>
    </div>
  );
}
