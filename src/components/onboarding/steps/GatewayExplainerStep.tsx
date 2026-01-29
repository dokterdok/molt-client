import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "../../../lib/utils";

interface GatewayExplainerStepProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function GatewayExplainerStep({
  onNext,
  onBack,
  onSkip,
}: GatewayExplainerStepProps) {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus primary button
    primaryButtonRef.current?.focus();

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
      className="flex-1 flex flex-col items-center justify-center p-8"
      role="main"
      aria-labelledby="explainer-heading"
    >
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-xl shadow-blue-500/20 mb-6"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            aria-label="Gateway icon"
          >
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
          </motion.div>
          <h2 id="explainer-heading" className="text-4xl font-bold mb-3">
            How Moltz Works
          </h2>
          <p className="text-lg text-muted-foreground">
            Moltz connects directly to your stuff—no cloud required
          </p>
        </motion.div>

        {/* Explanation cards */}
        <div className="space-y-4" role="list" aria-label="Gateway features">
          {[
            {
              icon: "🔐",
              title: "Everything Stays Private",
              desc: "Moltz runs on your computer, not in the cloud. Your emails, calendar, and files never leave your machine. It's like having an assistant who works at your desk, not at someone else's office.",
              gradient: "from-green-500/10 to-emerald-500/10",
              border: "border-green-500/20",
              iconBg: "bg-green-500/20",
              titleColor: "text-green-600 dark:text-green-400",
            },
            {
              icon: "🔌",
              title: "Talks to Your Apps",
              desc: "Moltz connects to your calendar, email, files, and more—right on your computer. Your passwords and login info stay on your machine.",
              gradient: "from-purple-500/10 to-pink-500/10",
              border: "border-purple-500/20",
              iconBg: "bg-purple-500/20",
              titleColor: "text-purple-600 dark:text-purple-400",
            },
            {
              icon: "⚡",
              title: "Super Fast",
              desc: "Because everything runs locally on your computer, responses are instant. No waiting for the cloud!",
              gradient: "from-orange-500/10 to-red-500/10",
              border: "border-orange-500/20",
              iconBg: "bg-orange-500/20",
              titleColor: "text-orange-600 dark:text-orange-400",
            },
          ].map((card, index) => (
            <motion.div
              key={card.title}
              role="listitem"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.2 + index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={{
                scale: 1.02,
                x: 4,
                transition: { type: "spring", stiffness: 400, damping: 25 },
              }}
              className={cn(
                "p-6 rounded-xl bg-gradient-to-br border",
                card.gradient,
                card.border,
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    card.iconBg,
                  )}
                >
                  <span className="text-2xl" role="img" aria-label={card.title}>
                    {card.icon}
                  </span>
                </div>
                <div>
                  <h3 className={cn("font-semibold mb-1", card.titleColor)}>
                    {card.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex items-center justify-between pt-4"
        >
          <motion.button
            onClick={onBack}
            whileHover={{ scale: 1.05, x: -2 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-muted focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Go back to previous step"
          >
            ← Back
          </motion.button>

          <div className="flex items-center gap-3">
            <motion.button
              onClick={onSkip}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-muted focus:ring-offset-2 focus:ring-offset-background rounded px-3 py-1"
              aria-label="Skip setup"
            >
              Skip setup
            </motion.button>
            <motion.button
              ref={primaryButtonRef}
              onClick={onNext}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background"
              aria-label="Continue to connection setup"
            >
              Got it, let's connect →
            </motion.button>
          </div>
        </motion.div>

        {/* Keyboard hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="text-center text-xs text-muted-foreground"
        >
          Press{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Enter</kbd>{" "}
          to continue
        </motion.p>
      </div>
    </div>
  );
}
