export interface TagFields {
  title: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string;
  track: number | null;
}

export interface Track {
  path: string;
  fileName: string;
  format: string;
  sizeBytes: number;
  durationSecs: number | null;
  tags: TagFields;
  tagSource: string | null;
}

export interface FileLoadError {
  path: string;
  message: string;
}

export interface LoadTracksResult {
  tracks: Track[];
  errors: FileLoadError[];
}

export interface SaveTrackRequest {
  path: string;
  tags: TagFields;
}

export interface MusicBrainzResult {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  year: number | null;
  track: number | null;
  score: number | null;
  country: string | null;
}

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface TagDraft {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  track: string;
}
