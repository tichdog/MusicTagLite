import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CoverChange,
  TagFields,
  ToastItem,
  ToastKind,
  Track,
} from "./types";
import {
  chooseAudioFiles,
  isSupportedAudioPath,
  isTauriRuntime,
  loadTracks,
  saveTrack,
  subscribeToFileDrop,
} from "./lib/api";
import { basename } from "./lib/format";
import { readError } from "./lib/errors";
import { useSettings } from "./settings";
import { Sidebar } from "./components/Sidebar";
import { EmptyState } from "./components/EmptyState";
import { TagEditor } from "./components/TagEditor";
import { Toasts } from "./components/Toasts";
import { PlusIcon } from "./components/Icons";

export default function App() {
  const { t } = useSettings();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const selectedTrack =
    tracks.find((track) => track.path === selectedPath) ?? null;

  const addToast = useCallback((kind: ToastKind, message: string) => {
    const id = ++toastId.current;
    setToasts((current) => [
      ...current.slice(-2),
      { id, kind, message },
    ]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }
    const timers = toasts.map((toast) =>
      window.setTimeout(
        () => dismissToast(toast.id),
        toast.kind === "error" ? 9000 : 5000,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, dismissToast]);

  const addPaths = useCallback(
    async (incoming: string[]) => {
      const unique = [...new Set(incoming)];
      const supported = unique.filter(isSupportedAudioPath);
      const skipped = unique.length - supported.length;

      if (supported.length === 0) {
        addToast("error", t("app.noSupported"));
        return;
      }

      const fresh = supported.filter(
        (path) => !tracksRef.current.some((track) => track.path === path),
      );

      if (fresh.length === 0) {
        addToast("info", t("app.alreadyAdded"));
        return;
      }

      setIsLoading(true);
      try {
        const result = await loadTracks(fresh);

        if (result.tracks.length > 0) {
          setTracks((current) => {
            const known = new Set(current.map((track) => track.path));
            return [
              ...current,
              ...result.tracks.filter((track) => !known.has(track.path)),
            ];
          });
          addToast(
            "success",
            result.tracks.length === 1
              ? t("app.addedOne")
              : t("app.addedMany", { count: result.tracks.length }),
          );
        }

        for (const fileError of result.errors.slice(0, 2)) {
          addToast(
            "error",
            t("app.fileError", {
              name: basename(fileError.path),
              message: fileError.message,
            }),
          );
        }
        if (result.errors.length > 2) {
          addToast(
            "error",
            t("app.moreErrors", { count: result.errors.length - 2 }),
          );
        }

        if (skipped > 0) {
          addToast(
            "info",
            skipped === 1
              ? t("app.skippedOne")
              : t("app.skippedMany", { count: skipped }),
          );
        }
      } catch (error) {
        addToast(
          "error",
          t("app.loadFailed", {
            message: readError(error, t("errors.unexpected")),
          }),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, t],
  );

  const handleAdd = useCallback(async () => {
    try {
      const paths = await chooseAudioFiles(
        t("dialog.addFiles"),
        t("dialog.audioFiles"),
        t("dialog.desktopOnly"),
      );
      if (paths.length > 0) {
        await addPaths(paths);
      }
    } catch (error) {
      addToast("error", readError(error, t("errors.unexpected")));
    }
  }, [addPaths, addToast, t]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    subscribeToFileDrop({
      onDragActive: setIsDragActive,
      onDrop: (paths) => {
        void addPaths(paths);
      },
    })
      .then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      })
      .catch((error) => {
        if (!disposed) {
          addToast(
            "error",
            t("app.dragUnavailable", {
              message: readError(error, t("errors.unexpected")),
            }),
          );
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [addPaths, addToast, t]);

  useEffect(() => {
    if (tracks.length === 0) {
      if (selectedPath !== null) {
        setSelectedPath(null);
        setIsDirty(false);
      }
      return;
    }

    if (
      selectedPath === null ||
      !tracks.some((track) => track.path === selectedPath)
    ) {
      setSelectedPath(tracks[0].path);
      setIsDirty(false);
    }
  }, [tracks, selectedPath]);

  const handleSelect = useCallback(
    (path: string) => {
      if (path === selectedPath) {
        return;
      }
      if (isDirty && !window.confirm(t("app.confirmDiscard"))) {
        return;
      }
      setSelectedPath(path);
      setIsDirty(false);
    },
    [isDirty, selectedPath, t],
  );

  const handleSave = useCallback(
    async (path: string, tags: TagFields, cover?: CoverChange) => {
      const updated = await saveTrack({ path, tags, cover });
      setTracks((current) =>
        current.map((track) => (track.path === path ? updated : track)),
      );
    },
    [],
  );

  const handleRemove = useCallback(() => {
    if (!selectedTrack) {
      return;
    }
    if (isDirty && !window.confirm(t("app.confirmRemove"))) {
      return;
    }

    const index = tracks.findIndex(
      (track) => track.path === selectedTrack.path,
    );
    const nextTrack = tracks[index + 1] ?? tracks[index - 1] ?? null;

    setTracks((current) =>
      current.filter((track) => track.path !== selectedTrack.path),
    );
    setSelectedPath(nextTrack?.path ?? null);
    setIsDirty(false);
  }, [isDirty, selectedTrack, t, tracks]);

  return (
    <div className={`app-shell${isDragActive ? " is-dragging" : ""}`}>
      <Sidebar
        tracks={tracks}
        selectedPath={selectedPath}
        isLoading={isLoading}
        onAdd={handleAdd}
        onSelect={handleSelect}
      />

      <main className="workspace">
        {selectedTrack ? (
          <TagEditor
            key={selectedTrack.path}
            track={selectedTrack}
            onSave={handleSave}
            onDirtyChange={setIsDirty}
            onRemove={handleRemove}
            onNotify={addToast}
          />
        ) : (
          <EmptyState isLoading={isLoading} onAdd={handleAdd} />
        )}
      </main>

      {isDragActive && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay-card">
            <span className="drop-overlay-icon">
              <PlusIcon width={28} height={28} />
            </span>
            <strong>{t("app.dropTitle")}</strong>
            <span>{t("app.formatsShort")}</span>
          </div>
        </div>
      )}

      <Toasts toasts={toasts} onDismiss={dismissToast} />

      {!isTauriRuntime() && (
        <div className="browser-note">{t("app.browserNote")}</div>
      )}
    </div>
  );
}
