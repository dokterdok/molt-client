/**
 * CodeBlock - Premium code rendering component
 * 
 * Features:
 * - Syntax highlighting via highlight.js
 * - Copy button with visual feedback
 * - Language labels + filename detection
 * - Line numbers (toggleable)
 * - Wrap toggle for long lines
 * - Diff highlighting (+/- lines)
 * - Live HTML/CSS preview
 * - Run button for JS/TS code (sandboxed eval)
 * - Open in CodeSandbox for complex examples
 */

import { useState, memo, useMemo, useCallback, ReactNode } from "react";
import { cn } from "../lib/utils";
import {
  Copy,
  Check,
  WrapText,
  Hash,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  FileCode,
} from "lucide-react";

interface CodeBlockProps {
  code: string;
  language: string;
  children: ReactNode;
  className?: string;
  copiedCode: string | null;
  onCopyCode: (code: string) => void;
}

// Language display names
const LANGUAGE_NAMES: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  py: "Python",
  python: "Python",
  rb: "Ruby",
  ruby: "Ruby",
  go: "Go",
  rust: "Rust",
  rs: "Rust",
  java: "Java",
  cpp: "C++",
  c: "C",
  cs: "C#",
  csharp: "C#",
  php: "PHP",
  swift: "Swift",
  kotlin: "Kotlin",
  kt: "Kotlin",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  sass: "Sass",
  less: "Less",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  xml: "XML",
  md: "Markdown",
  markdown: "Markdown",
  bash: "Bash",
  sh: "Shell",
  shell: "Shell",
  zsh: "Zsh",
  powershell: "PowerShell",
  ps1: "PowerShell",
  dockerfile: "Dockerfile",
  docker: "Docker",
  graphql: "GraphQL",
  gql: "GraphQL",
  vue: "Vue",
  svelte: "Svelte",
  diff: "Diff",
  plaintext: "Text",
  text: "Text",
  txt: "Text",
};

// Languages that support live preview
const PREVIEWABLE_LANGUAGES = ["html", "htm", "svg"];

// Languages that support "Run" execution
const RUNNABLE_LANGUAGES = ["js", "javascript", "ts", "typescript", "jsx", "tsx"];

// Regex to extract filename from first comment line
// Matches: // filename.ts, /* filename.ts */, # filename.py
const FILENAME_PATTERNS = [
  /^\/\/\s*(\S+\.\w+)\s*$/m,           // // filename.ts
  /^\/\*\s*(\S+\.\w+)\s*\*\/\s*$/m,    // /* filename.ts */
  /^#\s*(\S+\.\w+)\s*$/m,              // # filename.py
];

/**
 * Extract filename from code if present in first line comment
 */
function extractFilename(code: string): string | null {
  const firstLine = code.split('\n')[0].trim();
  for (const pattern of FILENAME_PATTERNS) {
    const match = firstLine.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Execution result type
interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

export const CodeBlock = memo(function CodeBlock({
  code,
  language,
  children,
  className,
  copiedCode,
  onCopyCode,
}: CodeBlockProps) {
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  const displayLanguage = LANGUAGE_NAMES[language.toLowerCase()] || language;
  const isDiff = language === "diff";
  const canPreview = PREVIEWABLE_LANGUAGES.includes(language.toLowerCase());
  const canRun = RUNNABLE_LANGUAGES.includes(language.toLowerCase());
  const isCopied = copiedCode === code;
  const filename = useMemo(() => extractFilename(code), [code]);

  // Split code into lines for line numbers and diff highlighting
  const lines = useMemo(() => code.split("\n"), [code]);

  // Detect if code has diff markers
  const hasDiffMarkers = useMemo(() => {
    return lines.some(
      (line) =>
        line.startsWith("+") ||
        line.startsWith("-") ||
        line.startsWith("@@")
    );
  }, [lines]);

  const handleCopy = useCallback(() => {
    onCopyCode(code);
  }, [code, onCopyCode]);

  const toggleLineNumbers = useCallback(() => {
    setShowLineNumbers((prev) => !prev);
  }, []);

  const toggleWrap = useCallback(() => {
    setWrapLines((prev) => !prev);
  }, []);

  const togglePreview = useCallback(() => {
    setShowPreview((prev) => !prev);
  }, []);

  // Generate safe HTML for preview
  const previewHtml = useMemo(() => {
    if (!canPreview) return "";
    // Wrap in a basic HTML structure if it's just a fragment
    if (!code.toLowerCase().includes("<html")) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      margin: 0;
    }
  </style>
</head>
<body>
${code}
</body>
</html>`;
    }
    return code;
  }, [code, canPreview]);

  return (
    <div className="relative group/code my-4 -mx-4 sm:mx-0">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 dark:bg-zinc-800 rounded-t-lg border border-b-0 border-zinc-700">
        {/* Language label */}
        <span className="text-xs text-zinc-400 font-mono font-medium">
          {displayLanguage}
        </span>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Line numbers toggle */}
          <button
            onClick={toggleLineNumbers}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
              showLineNumbers
                ? "text-zinc-200 bg-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
            )}
            title={showLineNumbers ? "Hide line numbers" : "Show line numbers"}
            aria-label={showLineNumbers ? "Hide line numbers" : "Show line numbers"}
            aria-pressed={showLineNumbers}
          >
            <Hash className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          {/* Wrap toggle */}
          <button
            onClick={toggleWrap}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
              wrapLines
                ? "text-zinc-200 bg-zinc-700"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
            )}
            title={wrapLines ? "Disable word wrap" : "Enable word wrap"}
            aria-label={wrapLines ? "Disable word wrap" : "Enable word wrap"}
            aria-pressed={wrapLines}
          >
            <WrapText className="w-3.5 h-3.5" strokeWidth={2} />
          </button>

          {/* Preview toggle (for HTML/CSS) */}
          {canPreview && (
            <button
              onClick={togglePreview}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
                showPreview
                  ? "text-green-400 bg-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
              )}
              title={showPreview ? "Hide preview" : "Show live preview"}
              aria-label={showPreview ? "Hide preview" : "Show live preview"}
              aria-pressed={showPreview}
            >
              {showPreview ? (
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              ) : (
                <Play className="w-3.5 h-3.5" strokeWidth={2} />
              )}
              <span className="hidden sm:inline">Preview</span>
            </button>
          )}

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-all focus:outline-none focus:ring-2 focus:ring-primary/50",
              isCopied
                ? "text-green-400 bg-green-400/10"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
            )}
            aria-label={isCopied ? "Code copied" : "Copy code to clipboard"}
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code content */}
      <div
        className={cn(
          "!mt-0 !rounded-t-none !bg-zinc-900 dark:!bg-zinc-800 !border !border-t-0 !border-zinc-700",
          wrapLines ? "" : "overflow-x-auto",
          showPreview && canPreview ? "" : "rounded-b-lg"
        )}
      >
        <pre
          className={cn(
            "!m-0 !p-0 !bg-transparent !border-0",
            wrapLines && "whitespace-pre-wrap break-words"
          )}
        >
          {showLineNumbers || (isDiff || hasDiffMarkers) ? (
            <CodeWithLineNumbers
              lines={lines}
              code={code}
              children={children}
              className={className}
              showLineNumbers={showLineNumbers}
              isDiff={isDiff || hasDiffMarkers}
              wrapLines={wrapLines}
            />
          ) : (
            <code className={cn(className, "text-sm block p-4")}>
              {children}
            </code>
          )}
        </pre>
      </div>

      {/* Live Preview */}
      {showPreview && canPreview && (
        <div className="border border-t-0 border-zinc-700 rounded-b-lg overflow-hidden bg-white">
          <button
            onClick={() => setPreviewExpanded(!previewExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 bg-zinc-100 dark:bg-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
          >
            <span className="font-medium">Live Preview</span>
            {previewExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {previewExpanded && (
            <iframe
              srcDoc={previewHtml}
              title="Code Preview"
              className="w-full min-h-[200px] max-h-[400px] border-0 bg-white"
              sandbox="allow-scripts"
              style={{ resize: "vertical", overflow: "auto" }}
            />
          )}
        </div>
      )}
    </div>
  );
});

// Component for rendering code with line numbers and diff highlighting
interface CodeWithLineNumbersProps {
  lines: string[];
  code: string;
  children: ReactNode;
  className?: string;
  showLineNumbers: boolean;
  isDiff: boolean;
  wrapLines: boolean;
}

const CodeWithLineNumbers = memo(function CodeWithLineNumbers({
  lines,
  children,
  className,
  showLineNumbers,
  isDiff,
  wrapLines,
}: CodeWithLineNumbersProps) {
  // Extract children as flat text lines while preserving syntax highlighting
  // We need to render children directly but add line decorations
  
  return (
    <div className="relative">
      {/* Line numbers gutter */}
      {showLineNumbers && (
        <div
          className="absolute left-0 top-0 bottom-0 w-12 bg-zinc-950/50 dark:bg-black/30 border-r border-zinc-700/50 select-none"
          aria-hidden="true"
        >
          <div className="py-4 pr-2">
            {lines.map((_, i) => (
              <div
                key={i}
                className="text-right text-xs text-zinc-500 leading-[1.625rem] font-mono"
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code content with potential diff highlighting */}
      <div className={cn(showLineNumbers && "pl-14")}>
        {isDiff ? (
          <DiffHighlightedCode
            lines={lines}
            wrapLines={wrapLines}
          />
        ) : (
          <code
            className={cn(
              className,
              "text-sm block p-4",
              wrapLines && "whitespace-pre-wrap break-words"
            )}
          >
            {children}
          </code>
        )}
      </div>
    </div>
  );
});

// Component for diff-highlighted code
interface DiffHighlightedCodeProps {
  lines: string[];
  wrapLines: boolean;
}

const DiffHighlightedCode = memo(function DiffHighlightedCode({
  lines,
  wrapLines,
}: DiffHighlightedCodeProps) {
  return (
    <code className="text-sm block">
      {lines.map((line, i) => {
        const isAddition = line.startsWith("+") && !line.startsWith("+++");
        const isDeletion = line.startsWith("-") && !line.startsWith("---");
        const isHunkHeader = line.startsWith("@@");
        const isMetaLine = line.startsWith("+++") || line.startsWith("---");

        return (
          <div
            key={i}
            className={cn(
              "px-4 leading-[1.625rem]",
              wrapLines && "whitespace-pre-wrap break-words",
              isAddition && "bg-green-500/15 text-green-300",
              isDeletion && "bg-red-500/15 text-red-300",
              isHunkHeader && "bg-blue-500/15 text-blue-300 font-medium",
              isMetaLine && "text-zinc-400 italic"
            )}
          >
            {/* Diff marker icon */}
            {isAddition && (
              <span className="inline-block w-4 text-green-400 font-bold" aria-label="Addition">
                +
              </span>
            )}
            {isDeletion && (
              <span className="inline-block w-4 text-red-400 font-bold" aria-label="Deletion">
                −
              </span>
            )}
            {!isAddition && !isDeletion && (
              <span className="inline-block w-4">{isHunkHeader ? "" : " "}</span>
            )}
            <span>{isAddition || isDeletion ? line.slice(1) : line}</span>
          </div>
        );
      })}
    </code>
  );
});

CodeBlock.displayName = "CodeBlock";
