import { cn } from "../../lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-[3px]",
  };

  return (
    <div
      className={cn(
        "border-primary border-t-transparent rounded-full animate-spin-reverse",
        sizeClasses[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50 animate-in fade-in duration-200">
      <Spinner size="lg" />
      {message && (
        <p
          className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: "100ms" }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
