import { useState, useCallback, SyntheticEvent, MouseEvent, useRef, useEffect } from "react";
import { cn } from "../lib/utils";
import { X, Loader2, ImageOff, ExternalLink, ZoomIn } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface ImageRendererProps {
  src: string;
  alt?: string;
  className?: string;
  maxWidth?: number;
  maxHeight?: number;
}

// URL patterns that are considered safe
const SAFE_URL_PATTERNS = [
  /^https:\/\//i,
  /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i,
];

// Check if URL is safe to load
function isSafeUrl(url: string): boolean {
  return SAFE_URL_PATTERNS.some((pattern) => pattern.test(url));
}

// Sanitize URL - only allow safe protocols
function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();

  if (isSafeUrl(trimmed)) {
    return trimmed;
  }

  // HTTP URLs - warn but allow (some APIs don't support HTTPS)
  if (/^http:\/\//i.test(trimmed)) {
    console.warn("Loading image over insecure HTTP:", trimmed);
    return trimmed;
  }

  return null;
}

export function ImageRenderer({
  src,
  alt = "Image",
  className,
  maxWidth = 400,
  maxHeight = 400,
}: ImageRendererProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  const sanitizedSrc = sanitizeUrl(src);

  // Focus trap for lightbox
  useFocusTrap(lightboxRef, isExpanded);

  const handleLoad = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const openInNewTab = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (sanitizedSrc) {
        window.open(sanitizedSrc, "_blank", "noopener,noreferrer");
      }
    },
    [sanitizedSrc],
  );

  // Don't render if URL is not safe
  if (!sanitizedSrc) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-lg text-sm",
          className,
        )}
      >
        <ImageOff className="w-4 h-4" />
        <span>Blocked: unsafe image source</span>
      </div>
    );
  }

  // Calculate constrained dimensions
  const getConstrainedStyle = () => {
    if (!dimensions) return { maxWidth, maxHeight };

    const aspectRatio = dimensions.width / dimensions.height;
    let width = dimensions.width;
    let height = dimensions.height;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return { width, height };
  };

  return (
    <>
      {/* Image container */}
      <div
        className={cn("relative inline-block group cursor-pointer", className)}
        onClick={() => setIsExpanded(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Expand image: ${alt}`}
      >
        {/* Loading state */}
        {isLoading && !hasError && (
          <div
            className="flex items-center justify-center bg-muted rounded-lg animate-pulse"
            style={{ width: 200, height: 150 }}
          >
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div
            className="flex flex-col items-center justify-center gap-2 bg-muted rounded-lg p-4"
            style={{ width: 200, height: 100 }}
          >
            <ImageOff className="w-6 h-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Failed to load image
            </span>
          </div>
        )}

        {/* Actual image */}
        <img
          src={sanitizedSrc}
          alt={alt}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "rounded-lg transition-all duration-200",
            isLoading && "opacity-0 absolute",
            hasError && "hidden",
            "hover:shadow-lg",
          )}
          style={getConstrainedStyle()}
        />

        {/* Hover overlay with expand hint */}
        {!isLoading && !hasError && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 rounded-lg flex items-center justify-center">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
        )}
      </div>

      {/* Lightbox modal */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-in fade-in duration-200"
          onClick={() => setIsExpanded(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsExpanded(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          {/* Close button */}
          <button
            onClick={() => setIsExpanded(false)}
            className="absolute top-4 right-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Close image (Escape)"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Open in new tab button */}
          <button
            onClick={openInNewTab}
            className="absolute top-4 right-16 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Open image in new tab"
          >
            <ExternalLink className="w-6 h-6" />
          </button>

          {/* Expanded image */}
          <img
            src={sanitizedSrc}
            alt={alt}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Image info */}
          {dimensions && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 text-white/70 text-sm rounded-full">
              {dimensions.width} × {dimensions.height}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Parse message content for inline images (base64 data URIs and URLs)
 * Returns an array of text/image segments for rendering
 */
export interface ContentSegment {
  type: "text" | "image";
  content: string;
  alt?: string;
}

// Regex to match image URLs and base64 data URIs
const IMAGE_URL_REGEX =
  /!\[([^\]]*)\]\(((?:https?:\/\/[^\s)]+|data:image\/[^;]+;base64,[^\s)]+))\)/g;
const STANDALONE_IMAGE_URL_REGEX =
  /(?<![([])(https?:\/\/[^\s<>)]+\.(?:png|jpg|jpeg|gif|webp|svg))(?![)\]])/gi;
const BASE64_IMAGE_REGEX =
  /(data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*)/g;

export function parseImageContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  // Combined regex for all image patterns
  const combinedRegex = new RegExp(
    `${IMAGE_URL_REGEX.source}|${STANDALONE_IMAGE_URL_REGEX.source}|${BASE64_IMAGE_REGEX.source}`,
    "gi",
  );

  let match;
  while ((match = combinedRegex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        segments.push({ type: "text", content: textBefore });
      }
    }

    // Determine what type of match this is
    if (match[0].startsWith("![")) {
      // Markdown image: ![alt](url)
      segments.push({
        type: "image",
        content: match[2], // URL
        alt: match[1] || "Image",
      });
    } else if (match[0].startsWith("data:")) {
      // Base64 data URI
      segments.push({ type: "image", content: match[0], alt: "Image" });
    } else {
      // Standalone URL
      segments.push({ type: "image", content: match[0], alt: "Image" });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    if (remaining.trim()) {
      segments.push({ type: "text", content: remaining });
    }
  }

  // If no images found, return original content as text
  if (segments.length === 0) {
    return [{ type: "text", content }];
  }

  return segments;
}
