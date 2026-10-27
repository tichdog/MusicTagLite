import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  LoadTracksResult,
  MusicBrainzResult,
  SaveTrackRequest,
  Track,
} from "../types";

export const AUDIO_EXTENSIONS = [
  "mp3",
  "flac",
  "ogg",
  "oga",
  "opus",
  "m4a",
  "mp4",
  "wav",
] as const;

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isSupportedAudioPath(path: string): boolean {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return (AUDIO_EXTENSIONS as readonly string[]).includes(extension);
}

export async function chooseAudioFiles(): Promise<string[]> {
  if (!isTauriRuntime()) {
    throw new Error("The file picker is only available in the desktop app.");
  }

  const selection = await open({
    multiple: true,
    directory: false,
    title: "Add music files",
    filters: [
      {
        name: "Audio files",
        extensions: [...AUDIO_EXTENSIONS],
      },
    ],
  });

  if (selection === null) {
    return [];
  }

  return Array.isArray(selection) ? selection : [selection];
}

export async function loadTracks(paths: string[]): Promise<LoadTracksResult> {
  return invoke<LoadTracksResult>("load_tracks", { paths });
}

export async function saveTrack(request: SaveTrackRequest): Promise<Track> {
  return invoke<Track>("save_track", { request });
}

export async function searchMusicBrainz(
  query: string,
): Promise<MusicBrainzResult[]> {
  return invoke<MusicBrainzResult[]>("search_musicbrainz", { query });
}

type DragDropHandlers = {
  onDragActive: (active: boolean) => void;
  onDrop: (paths: string[]) => void;
};

/**
 * Subscribes to native file drag & drop. Returns an unsubscribe function.
 * No-op outside the Tauri runtime.
 */
export async function subscribeToFileDrop({
  onDragActive,
  onDrop,
}: DragDropHandlers): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }

  const { getCurrentWebview } = await import("@tauri-apps/api/webview");
  return getCurrentWebview().onDragDropEvent((event) => {
    switch (event.payload.type) {
      case "enter":
      case "over":
        onDragActive(true);
        break;
      case "drop":
        onDragActive(false);
        onDrop(event.payload.paths);
        break;
      case "leave":
        onDragActive(false);
        break;
    }
  });
}
