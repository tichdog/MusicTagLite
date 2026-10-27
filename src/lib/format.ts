import type { TagDraft, TagFields, Track } from "../types";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) {
    return null;
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function formatLabel(format: string): string {
  return format.toUpperCase();
}

export function trackHeading(track: Track): string {
  return track.tags.title.trim() || track.fileName;
}

export function trackSubheading(track: Track): string {
  return track.tags.artist.trim() || "Unknown artist";
}

export function draftFromTags(tags: TagFields): TagDraft {
  return {
    title: tags.title,
    artist: tags.artist,
    album: tags.album,
    year: tags.year === null ? "" : String(tags.year),
    genre: tags.genre,
    track: tags.track === null ? "" : String(tags.track),
  };
}

export function draftEqualsTags(draft: TagDraft, tags: TagFields): boolean {
  return (
    draft.title === tags.title &&
    draft.artist === tags.artist &&
    draft.album === tags.album &&
    draft.genre === tags.genre &&
    draft.year === (tags.year === null ? "" : String(tags.year)) &&
    draft.track === (tags.track === null ? "" : String(tags.track))
  );
}

export interface DraftValidation {
  fields: TagFields | null;
  errors: Partial<Record<"year" | "track", string>>;
}

export function validateDraft(draft: TagDraft): DraftValidation {
  const errors: DraftValidation["errors"] = {};

  const yearText = draft.year.trim();
  let year: number | null = null;
  if (yearText.length > 0) {
    if (!/^\d{1,4}$/.test(yearText)) {
      errors.year = "Enter a year from 0 to 9999.";
    } else {
      year = Number(yearText);
    }
  }

  const trackText = draft.track.trim();
  let track: number | null = null;
  if (trackText.length > 0) {
    if (!/^\d{1,4}$/.test(trackText) || Number(trackText) === 0) {
      errors.track = "Track number must be between 1 and 9999.";
    } else {
      track = Number(trackText);
    }
  }

  return {
    fields:
      Object.keys(errors).length > 0
        ? null
        : {
            title: draft.title.trim(),
            artist: draft.artist.trim(),
            album: draft.album.trim(),
            year,
            genre: draft.genre.trim(),
            track,
          },
    errors,
  };
}

export function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
