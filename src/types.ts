export interface TagFields {
  title: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string;
  track: number | null;
  albumArtist: string;
  trackTotal: number | null;
  disc: number | null;
  discTotal: number | null;
  composer: string;
  comment: string;
  lyrics: string;
  bpm: number | null;
  isrc: string;
  copyright: string;
  language: string;
  grouping: string;
  label: string;
  catalogNumber: string;
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

export type CoverChange =
  | { action: "set"; path: string }
  | { action: "remove" };

export interface CoverArt {
  mime: string;
  dataUrl: string;
  sizeBytes: number;
}

export interface SaveTrackRequest {
  path: string;
  tags: TagFields;
  cover?: CoverChange;
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
  albumArtist: string;
  trackTotal: string;
  disc: string;
  discTotal: string;
  composer: string;
  comment: string;
  lyrics: string;
  bpm: string;
  isrc: string;
  copyright: string;
  language: string;
  grouping: string;
  label: string;
  catalogNumber: string;
}
