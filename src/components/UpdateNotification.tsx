import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface UpdateInfo {
  available: boolean;
  version: string;
  current_version: string;
  body?: string;
  date?: string;
}

interface UpdateNotificationProps {
  onUpdateDismissed: () => void;
}

export function UpdateNotification({
  onUpdateDismissed,
}: UpdateNotificationProps) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for update-available events from backend
    const unlistenAvailable = listen<UpdateInfo>(
      "update-available",
      (event) => {
        setUpdateInfo(event.payload);
        setError(null);
      },
    );

    // Listen for download progress
    const unlistenProgress = listen<number>(
      "update-download-progress",
      (event) => {
        setDownloadProgress(event.payload);
      },
    );

    // Listen for download completion
    const unlistenDownloaded = listen("update-downloaded", () => {
      setIsInstalling(false);
      // The app will restart automatically via tauri-plugin-updater
    });

    // Check if there's already a pending update
    invoke<UpdateInfo | null>("get_update_status")
      .then((info) => {
        if (info?.available) {
          setUpdateInfo(info);
        }
      })
      .catch((err) => console.error("Failed to get update status:", err));

    return () => {
      unlistenAvailable.then((fn) => fn());
      unlistenProgress.then((fn) => fn());
      unlistenDownloaded.then((fn) => fn());
    };
  }, []);

  const handleUpdateNow = async () => {
    setIsInstalling(true);
    setError(null);
    setDownloadProgress(0);

    try {
      await invoke("install_update");
      // Update will be installed and app will restart
    } catch (err) {
      console.error("Update installation failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setIsInstalling(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await invoke("dismiss_update");
      setUpdateInfo(null);
      onUpdateDismissed();
    } catch (err) {
      console.error("Failed to dismiss update:", err);
    }
  };

  if (!updateInfo?.available) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className={cn(
          "fixed bottom-4 right-4 z-50",
          "w-96 rounded-lg shadow-2xl",
          "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700",
          "overflow-hidden",
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
              Update Available
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              Version {updateInfo.version} is ready to install
            </p>
          </div>
          <button
            onClick={handleDismiss}
            disabled={isInstalling}
            className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {error && (
            <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {isInstalling ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  Downloading...
                </span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {downloadProgress.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-600 dark:bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${downloadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                The app will restart automatically after installation
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {updateInfo.body && (
                <div className="text-xs text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
                  <p className="whitespace-pre-wrap">{updateInfo.body}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleUpdateNow}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-md text-sm font-medium",
                    "bg-blue-600 hover:bg-blue-700 text-white",
                    "transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    "dark:focus:ring-offset-gray-800",
                  )}
                >
                  Update Now
                </button>
                <button
                  onClick={handleDismiss}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-md text-sm font-medium",
                    "bg-gray-100 hover:bg-gray-200 text-gray-700",
                    "dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300",
                    "transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2",
                    "dark:focus:ring-offset-gray-800",
                  )}
                >
                  Later
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
