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

export function trackSubheading(track: Track, unknownArtist: string): string {
  return track.tags.artist.trim() || unknownArtist;
}

export function draftFromTags(tags: TagFields): TagDraft {
  return {
    title: tags.title,
    artist: tags.artist,
    album: tags.album,
    year: tags.year === null ? "" : String(tags.year),
    genre: tags.genre,
    track: tags.track === null ? "" : String(tags.track),
    albumArtist: tags.albumArtist,
    trackTotal: tags.trackTotal === null ? "" : String(tags.trackTotal),
    disc: tags.disc === null ? "" : String(tags.disc),
    discTotal: tags.discTotal === null ? "" : String(tags.discTotal),
    composer: tags.composer,
    comment: tags.comment,
    lyrics: tags.lyrics,
    bpm: tags.bpm === null ? "" : String(tags.bpm),
    isrc: tags.isrc,
    copyright: tags.copyright,
    language: tags.language,
    grouping: tags.grouping,
    label: tags.label,
    catalogNumber: tags.catalogNumber,
  };
}

export function draftEqualsTags(draft: TagDraft, tags: TagFields): boolean {
  return (
    draft.title === tags.title &&
    draft.artist === tags.artist &&
    draft.album === tags.album &&
    draft.genre === tags.genre &&
    draft.year === (tags.year === null ? "" : String(tags.year)) &&
    draft.track === (tags.track === null ? "" : String(tags.track)) &&
    draft.albumArtist === tags.albumArtist &&
    draft.trackTotal === (tags.trackTotal === null ? "" : String(tags.trackTotal)) &&
    draft.disc === (tags.disc === null ? "" : String(tags.disc)) &&
    draft.discTotal ===
      (tags.discTotal === null ? "" : String(tags.discTotal)) &&
    draft.composer === tags.composer &&
    draft.comment === tags.comment &&
    draft.lyrics === tags.lyrics &&
    draft.bpm === (tags.bpm === null ? "" : String(tags.bpm)) &&
    draft.isrc === tags.isrc &&
    draft.copyright === tags.copyright &&
    draft.language === tags.language &&
    draft.grouping === tags.grouping &&
    draft.label === tags.label &&
    draft.catalogNumber === tags.catalogNumber
  );
}

export type TagFieldError =
  | "year"
  | "track"
  | "trackTotal"
  | "disc"
  | "discTotal"
  | "bpm";

export interface DraftValidation {
  fields: TagFields | null;
  errors: Partial<Record<TagFieldError, TagFieldError>>;
}

const TRACK_LIMIT = 9999;
const BPM_LIMIT = 999;

function parseNumeric(
  value: string,
  field: TagFieldError,
  errors: DraftValidation["errors"],
  min: number,
  max: number,
): number | null {
  const text = value.trim();
  if (text.length === 0) {
    return null;
  }

  if (!/^\d{1,4}$/.test(text)) {
    errors[field] = field;
    return null;
  }

  const parsed = Number(text);
  if (parsed < min || parsed > max) {
    errors[field] = field;
    return null;
  }

  return parsed;
}

export function validateDraft(draft: TagDraft): DraftValidation {
  const errors: DraftValidation["errors"] = {};

  const yearText = draft.year.trim();
  let year: number | null = null;
  if (yearText.length > 0) {
    if (!/^\d{1,4}$/.test(yearText)) {
      errors.year = "year";
    } else {
      year = Number(yearText);
    }
  }

  const track = parseNumeric(draft.track, "track", errors, 1, TRACK_LIMIT);
  const trackTotal = parseNumeric(
    draft.trackTotal,
    "trackTotal",
    errors,
    1,
    TRACK_LIMIT,
  );
  const disc = parseNumeric(draft.disc, "disc", errors, 1, TRACK_LIMIT);
  const discTotal = parseNumeric(
    draft.discTotal,
    "discTotal",
    errors,
    1,
    TRACK_LIMIT,
  );
  const bpm = parseNumeric(draft.bpm, "bpm", errors, 1, BPM_LIMIT);

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
            albumArtist: draft.albumArtist.trim(),
            trackTotal,
            disc,
            discTotal,
            composer: draft.composer.trim(),
            comment: draft.comment,
            lyrics: draft.lyrics,
            bpm,
            isrc: draft.isrc.trim(),
            copyright: draft.copyright.trim(),
            language: draft.language.trim(),
            grouping: draft.grouping.trim(),
            label: draft.label.trim(),
            catalogNumber: draft.catalogNumber.trim(),
          },
    errors,
  };
}

export function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
