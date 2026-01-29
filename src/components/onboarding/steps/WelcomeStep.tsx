import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "../../../lib/utils";

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus primary button for keyboard navigation
    primaryButtonRef.current?.focus();

    // Auto-advance on Enter
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        document.activeElement === primaryButtonRef.current
      ) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNext]);

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto"
      role="main"
      aria-labelledby="welcome-heading"
    >
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Animated Moltz Logo */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.7,
            ease: [0.16, 1, 0.3, 1], // Custom easing for smooth feel
          }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-32 h-32 rounded-3xl bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 shadow-2xl shadow-orange-500/30 mb-8"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            aria-label="Moltz logo"
          >
            <motion.span
              className="text-7xl drop-shadow-lg"
              animate={{
                rotate: [0, -10, 10, -10, 10, 0],
              }}
              transition={{
                duration: 2,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 1,
              }}
              role="img"
              aria-label="Lobster emoji"
            >
              🦞
            </motion.span>
          </motion.div>
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.2,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <h1
            id="welcome-heading"
            className="text-6xl font-bold bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 bg-clip-text text-transparent mb-4"
          >
            Welcome to Moltz
          </h1>
          <p className="text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Your AI assistant that doesn't just chat—it actually{" "}
            <span className="font-semibold text-foreground">
              gets things done
            </span>
            .
          </p>
        </motion.div>

        {/* Feature highlights */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
          role="list"
          aria-label="Moltz features"
        >
          {[
            {
              icon: "📅",
              label: "Reschedule my 3pm and notify them",
              gradient: "from-orange-500/10 to-red-500/10",
              border: "border-orange-500/20",
            },
            {
              icon: "📧",
              label: "What did John email me about?",
              gradient: "from-red-500/10 to-pink-500/10",
              border: "border-red-500/20",
            },
            {
              icon: "📁",
              label: "Find that contract from last week",
              gradient: "from-pink-500/10 to-purple-500/10",
              border: "border-pink-500/20",
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.label}
              role="listitem"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
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
                "p-6 rounded-xl bg-gradient-to-br border",
                feature.gradient,
                feature.border,
              )}
            >
              <div
                className="text-3xl mb-3"
                role="img"
                aria-label={feature.label}
              >
                {feature.icon}
              </div>
              <p className="text-sm font-medium">{feature.label}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            delay: 0.7,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="flex flex-col items-center gap-4"
        >
          <motion.button
            ref={primaryButtonRef}
            onClick={onNext}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="group px-8 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold text-lg shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Get started with Moltz setup"
          >
            <span className="flex items-center gap-2">
              Get Started
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
            onClick={onSkip}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-muted focus:ring-offset-2 focus:ring-offset-background rounded px-3 py-1"
            aria-label="Skip setup and configure later"
          >
            Skip for now (you can set up later in Settings)
          </motion.button>
        </motion.div>

        {/* Keyboard hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.9 }}
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
