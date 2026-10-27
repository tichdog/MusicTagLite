import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type {
  MusicBrainzResult,
  TagDraft,
  TagFields,
  ToastKind,
  Track,
} from "../types";
import {
  draftEqualsTags,
  draftFromTags,
  formatBytes,
  formatDuration,
  validateDraft,
} from "../lib/format";
import { readError } from "../lib/errors";
import { MusicBrainzDialog } from "./MusicBrainzDialog";
import {
  MusicIcon,
  SaveIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  UndoIcon,
} from "./Icons";

interface TagEditorProps {
  track: Track;
  onSave: (path: string, tags: TagFields) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onRemove: () => void;
  onNotify: (kind: ToastKind, message: string) => void;
}

interface FieldProps {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
  error?: string;
  hint?: string;
}

function Field({ id, label, children, className, error, hint }: FieldProps) {
  const helpId = error || hint ? `${id}-help` : undefined;
  return (
    <div className={`field${className ? ` ${className}` : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span id={helpId} className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={helpId} className="field-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

const GENRE_SUGGESTIONS = [
  "Pop",
  "Rock",
  "Hip-Hop",
  "R&B",
  "Jazz",
  "Classical",
  "Electronic",
  "Dance",
  "Metal",
  "Folk",
  "Country",
  "Soundtrack",
];

export function TagEditor({
  track,
  onSave,
  onDirtyChange,
  onRemove,
  onNotify,
}: TagEditorProps) {
  const [draft, setDraft] = useState<TagDraft>(() => draftFromTags(track.tags));
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"year" | "track", string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);

  const dirty = useMemo(
    () => !draftEqualsTags(draft, track.tags),
    [draft, track.tags],
  );

  const duration = formatDuration(track.durationSecs);

  useEffect(() => {
    setDraft(draftFromTags(track.tags));
    setFieldErrors({});
  }, [track.tags]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const update = useCallback((field: keyof TagDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === "year" || field === "track") {
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) {
      return;
    }

    const validation = validateDraft(draft);
    setFieldErrors(validation.errors);
    if (!validation.fields) {
      return;
    }

    setSaving(true);
    try {
      await onSave(track.path, validation.fields);
      onNotify("success", `Tags saved to ${track.fileName}.`);
    } catch (saveError) {
      onNotify("error", `Could not save tags — ${readError(saveError)}`);
    } finally {
      setSaving(false);
    }
  }, [draft, onNotify, onSave, saving, track.fileName, track.path]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && !saving && !lookupOpen) {
          void handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dirty, handleSave, lookupOpen, saving]);

  function resetDraft() {
    setDraft(draftFromTags(track.tags));
    setFieldErrors({});
  }

  function applyMusicBrainz(result: MusicBrainzResult) {
    setDraft((current) => ({
      ...current,
      title: result.title || current.title,
      artist: result.artist || current.artist,
      album: result.album ?? current.album,
      year: result.year === null ? current.year : String(result.year),
      track: result.track === null ? current.track : String(result.track),
    }));
    setFieldErrors({});
    setLookupOpen(false);
    onNotify("info", "Metadata applied. Review it, then save your changes.");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSave();
  }

  return (
    <section className="editor">
      <header className="editor-head">
        <div
          className="editor-format"
          data-format={track.format.toLowerCase()}
          aria-hidden="true"
        >
          {track.format}
        </div>

        <div className="editor-file">
          <h1>{draft.title.trim() || track.fileName}</h1>
          <p className="editor-path" title={track.path}>
            {track.path}
          </p>
        </div>

        <div className="editor-facts">
          {duration && <span className="fact">{duration}</span>}
          <span className="fact">{formatBytes(track.sizeBytes)}</span>
          <span
            className={`fact fact--tag${track.tagSource ? "" : " is-empty"}`}
            title="Tag format detected in this file"
          >
            {track.tagSource ?? "Untagged"}
          </span>
        </div>

        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={onRemove}
          title="Remove from list"
          aria-label="Remove track from list"
        >
          <TrashIcon width={17} height={17} />
        </button>
      </header>

      <form className="editor-form" onSubmit={handleSubmit} noValidate>
        <div className="editor-scroll">
          <div className="editor-inner">
          <div className="section-heading">
            <div>
              <h2>Metadata</h2>
              <p>Written into the file itself — audio is never re-encoded.</p>
            </div>
            <span className="tag-source-pill">
              <MusicIcon width={13} height={13} />
              {track.tagSource ?? "New tag"}
            </span>
          </div>

          <div className="form-grid">
            <Field id="tag-title" label="Title" className="span-2">
              <input
                id="tag-title"
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="Song title"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            <Field id="tag-artist" label="Artist">
              <input
                id="tag-artist"
                value={draft.artist}
                onChange={(event) => update("artist", event.target.value)}
                placeholder="Artist or band"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            <Field id="tag-album" label="Album">
              <input
                id="tag-album"
                value={draft.album}
                onChange={(event) => update("album", event.target.value)}
                placeholder="Album name"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>

            <div className="form-meta-row span-2">
              <Field
                id="tag-year"
                label="Year"
                className="field--short"
                error={fieldErrors.year}
              >
                <input
                  id="tag-year"
                  value={draft.year}
                  onChange={(event) =>
                    update("year", event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="2026"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.year)}
                  aria-describedby={
                    fieldErrors.year ? "tag-year-help" : undefined
                  }
                />
              </Field>

              <Field id="tag-genre" label="Genre">
                <input
                  id="tag-genre"
                  value={draft.genre}
                  onChange={(event) => update("genre", event.target.value)}
                  placeholder="Genre"
                  autoComplete="off"
                  spellCheck={false}
                  list="genre-suggestions"
                />
                <datalist id="genre-suggestions">
                  {GENRE_SUGGESTIONS.map((genre) => (
                    <option key={genre} value={genre} />
                  ))}
                </datalist>
              </Field>

              <Field
                id="tag-track"
                label="Track no."
                className="field--short"
                error={fieldErrors.track}
              >
                <input
                  id="tag-track"
                  value={draft.track}
                  onChange={(event) =>
                    update("track", event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="1"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.track)}
                  aria-describedby={
                    fieldErrors.track ? "tag-track-help" : undefined
                  }
                />
              </Field>
            </div>
          </div>

          <div className="lookup-card">
            <div className="lookup-info">
              <span className="lookup-icon">
                <SearchIcon width={18} height={18} />
              </span>
              <div>
                <strong>Fill metadata from MusicBrainz</strong>
                <span>
                  Search using the title and artist above, then pick a match.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn--subtle"
              onClick={() => setLookupOpen(true)}
            >
              Look up
            </button>
          </div>
          </div>
        </div>

        <footer className="editor-foot">
          <span
            className={`dirty-state${dirty ? " is-dirty" : ""}`}
            aria-live="polite"
          >
            <span className="dirty-dot" />
            {dirty ? "Unsaved changes" : "No unsaved changes"}
          </span>

          <div className="editor-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={resetDraft}
              disabled={!dirty || saving}
            >
              <UndoIcon width={16} height={16} />
              Reset
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!dirty || saving}
              title="Save changes (Ctrl+S)"
            >
              {saving ? (
                <SpinnerIcon className="spin" width={16} height={16} />
              ) : (
                <SaveIcon width={16} height={16} />
              )}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </footer>
      </form>

      {lookupOpen && (
        <MusicBrainzDialog
          initialTitle={draft.title}
          initialArtist={draft.artist}
          onApply={applyMusicBrainz}
          onClose={() => setLookupOpen(false)}
        />
      )}
    </section>
  );
}
