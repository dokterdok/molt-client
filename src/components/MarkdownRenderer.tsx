/**
 * MarkdownRenderer - Heavy markdown rendering component
 *
 * This module is lazy-loaded to keep the initial bundle small.
 * It contains react-markdown + remark-gfm + rehype-highlight + rehype-sanitize
 * (~336 kB unminified) which is only needed once messages are displayed.
 */

import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { ReactNode, isValidElement, memo, useMemo } from "react";
import { cn } from "../lib/utils";
import { ImageRenderer } from "./ImageRenderer";
import { Copy, Check } from "lucide-react";

// PERF: Memoize plugins to prevent re-creation on every render
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSanitize, rehypeHighlight];

// Type definitions for ReactMarkdown components
interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

interface LinkProps {
  href?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

interface ImageProps {
  src?: string;
  alt?: string;
  [key: string]: unknown;
}

interface TableProps {
  children?: ReactNode;
  [key: string]: unknown;
}

/**
 * Recursively extracts plain text from React children.
 * Handles strings, numbers, arrays, and React elements (e.g., syntax-highlighted spans).
 */
function extractTextFromChildren(children: ReactNode): string {
  if (children == null) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join("");
  }
  if (isValidElement(children)) {
    return extractTextFromChildren(children.props.children);
  }
  return "";
}

interface MarkdownRendererProps {
  content: string;
  copiedCode: string | null;
  onCopyCode: (code: string) => void;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  copiedCode,
  onCopyCode,
}: MarkdownRendererProps) {
  // PERF: Memoize components object to prevent re-creation
  const components = useMemo(
    () =>
      ({
        code({ inline, className, children, ...props }: CodeProps) {
          const match = /language-(\w+)/.exec(className || "");
          const code = extractTextFromChildren(children).replace(/\n$/, "");

          if (!inline && match) {
            return (
              <div className="relative group/code my-4 -mx-4 sm:mx-0">
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 dark:bg-zinc-800 rounded-t-lg border border-b-0 border-zinc-700">
                  <span className="text-xs text-zinc-400 font-mono">
                    {match[1]}
                  </span>
                  <button
                    onClick={() => onCopyCode(code)}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-2 py-1"
                    aria-label={
                      copiedCode === code
                        ? "Code copied"
                        : "Copy code to clipboard"
                    }
                  >
                    {copiedCode === code ? (
                      <>
                        <Check className="w-3.5 h-3.5" strokeWidth={2} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" strokeWidth={2} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="!mt-0 !rounded-t-none !bg-zinc-900 dark:!bg-zinc-800 !border !border-t-0 !border-zinc-700 overflow-x-auto">
                  <code className={cn(className, "text-sm")} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          }

          return (
            <code
              className="px-1.5 py-0.5 rounded-md bg-muted text-sm font-mono before:content-none after:content-none"
              {...props}
            >
              {children}
            </code>
          );
        },
        a({ href, children, ...props }: LinkProps) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              {...props}
            >
              {children}
            </a>
          );
        },
        img({ src, alt }: ImageProps) {
          if (!src) return null;
          return (
            <ImageRenderer src={src} alt={alt || "Image"} className="my-2" />
          );
        },
        table({ children, ...props }: TableProps) {
          return (
            <div className="overflow-x-auto my-4 rounded-lg border border-border">
              <table className="w-full" {...props}>
                {children}
              </table>
            </div>
          );
        },
      }) as Partial<Components>,
    [copiedCode, onCopyCode],
  );

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";
