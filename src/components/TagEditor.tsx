import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type {
  CoverArt,
  CoverChange,
  MusicBrainzResult,
  TagDraft,
  TagFields,
  ToastKind,
  Track,
} from "../types";
import {
  chooseImageFile,
  isTauriRuntime,
  previewImage,
  readCover,
} from "../lib/api";
import {
  draftEqualsTags,
  draftFromTags,
  formatBytes,
  formatDuration,
  validateDraft,
  type TagFieldError,
} from "../lib/format";
import { readError } from "../lib/errors";
import { useSettings } from "../settings";
import { MusicBrainzDialog } from "./MusicBrainzDialog";
import {
  ImageIcon,
  MusicIcon,
  SaveIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  UndoIcon,
} from "./Icons";

interface TagEditorProps {
  track: Track;
  onSave: (
    path: string,
    tags: TagFields,
    cover?: CoverChange,
  ) => Promise<void>;
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

type EditorTab = "tags" | "lyrics" | "details";

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

const LANGUAGE_SUGGESTIONS = [
  "eng",
  "rus",
  "deu",
  "fra",
  "spa",
  "ita",
  "jpn",
  "kor",
  "por",
  "ukr",
  "pol",
  "nld",
  "swe",
  "tur",
];

export function TagEditor({
  track,
  onSave,
  onDirtyChange,
  onRemove,
  onNotify,
}: TagEditorProps) {
  const { t } = useSettings();
  const [draft, setDraft] = useState<TagDraft>(() => draftFromTags(track.tags));
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<TagFieldError, TagFieldError>>
  >({});
  const [saving, setSaving] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("tags");
  const [cover, setCover] = useState<CoverArt | null>(null);
  const [savedCover, setSavedCover] = useState<CoverArt | null>(null);
  const [coverAction, setCoverAction] = useState<CoverChange | undefined>();
  const [coverLoading, setCoverLoading] = useState(true);
  const [coverBusy, setCoverBusy] = useState(false);

  const dirty = useMemo(
    () =>
      !draftEqualsTags(draft, track.tags) || coverAction !== undefined,
    [draft, track.tags, coverAction],
  );

  const duration = formatDuration(track.durationSecs);

  const lyricsLines =
    draft.lyrics.length === 0 ? 0 : draft.lyrics.split(/\r\n|\r|\n/).length;
  const lyricsChars = draft.lyrics.length;

  useEffect(() => {
    setDraft(draftFromTags(track.tags));
    setFieldErrors({});
  }, [track.tags]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setCoverLoading(false);
      return;
    }

    let disposed = false;
    setCoverLoading(true);
    setCoverAction(undefined);

    readCover(track.path)
      .then((artwork) => {
        if (!disposed) {
          setCover(artwork);
          setSavedCover(artwork);
        }
      })
      .catch((error) => {
        if (!disposed) {
          onNotify(
            "error",
            t("editor.coverFailed", {
              message: readError(error, t("errors.unexpected")),
            }),
          );
        }
      })
      .finally(() => {
        if (!disposed) {
          setCoverLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
    // The track path is the only reason to reload artwork.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.path]);

  const update = useCallback((field: keyof TagDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (
      field === "year" ||
      field === "track" ||
      field === "trackTotal" ||
      field === "disc" ||
      field === "discTotal" ||
      field === "bpm"
    ) {
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
      await onSave(track.path, validation.fields, coverAction);
      onNotify("success", t("editor.saved", { name: track.fileName }));

      if (coverAction) {
        setSavedCover(cover);
        setCoverAction(undefined);

        try {
          const stored = await readCover(track.path);
          setCover(stored);
          setSavedCover(stored);
        } catch {
          // The tags were written successfully; keep the preview if the
          // artwork cannot be re-read.
        }
      }
    } catch (saveError) {
      onNotify(
        "error",
        t("editor.saveFailed", {
          message: readError(saveError, t("errors.unexpected")),
        }),
      );
    } finally {
      setSaving(false);
    }
  }, [cover, coverAction, draft, onNotify, onSave, saving, t, track.fileName, track.path]);

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

  const handleChooseCover = useCallback(async () => {
    if (coverBusy || saving) {
      return;
    }

    try {
      const imagePath = await chooseImageFile(
        t("editor.chooseImage"),
        t("editor.imageFilter"),
        t("dialog.desktopOnly"),
      );
      if (!imagePath) {
        return;
      }

      setCoverBusy(true);
      const artwork = await previewImage(imagePath);
      setCover(artwork);
      setCoverAction({ action: "set", path: imagePath });
    } catch (error) {
      onNotify(
        "error",
        t("editor.coverFailed", {
          message: readError(error, t("errors.unexpected")),
        }),
      );
    } finally {
      setCoverBusy(false);
    }
  }, [coverBusy, onNotify, saving, t]);

  const handleRemoveCover = useCallback(() => {
    if (!cover || saving) {
      return;
    }

    setCover(null);
    setCoverAction({ action: "remove" });
  }, [cover, saving]);

  function resetDraft() {
    setDraft(draftFromTags(track.tags));
    setFieldErrors({});
    setCover(savedCover);
    setCoverAction(undefined);
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
    setActiveTab("tags");
    onNotify("info", t("editor.mbApplied"));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSave();
  }

  const tabs: Array<{ id: EditorTab; label: string }> = [
    { id: "tags", label: t("editor.tabTags") },
    { id: "lyrics", label: t("editor.tabLyrics") },
    { id: "details", label: t("editor.tabDetails") },
  ];

  const heading =
    activeTab === "tags"
      ? { title: t("editor.metadata"), hint: t("editor.metadataHint") }
      : activeTab === "lyrics"
        ? { title: t("editor.fieldLyrics"), hint: t("editor.lyricsHint") }
        : { title: t("editor.tabDetails"), hint: t("editor.detailsHint") };

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
            title={t("editor.tagFormatTitle")}
          >
            {track.tagSource ?? t("common.untagged")}
          </span>
        </div>

        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={onRemove}
          title={t("editor.remove")}
          aria-label={t("editor.removeAria")}
        >
          <TrashIcon width={17} height={17} />
        </button>
      </header>

      <form className="editor-form" onSubmit={handleSubmit} noValidate>
        <div className="editor-scroll">
          <div className="editor-inner">
          <div className="section-heading">
            <div>
              <h2>{heading.title}</h2>
              <p>{heading.hint}</p>
            </div>
            <span className="tag-source-pill">
              <MusicIcon width={13} height={13} />
              {track.tagSource ?? t("editor.newTag")}
            </span>
          </div>

          <div
            className="editor-tabs"
            role="tablist"
            aria-label={t("editor.metadata")}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`editor-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`editor-panel-${tab.id}`}
                className={`editor-tab${
                  activeTab === tab.id ? " is-active" : ""
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "tags" && (
            <div
              id="editor-panel-tags"
              role="tabpanel"
              aria-labelledby="editor-tab-tags"
              className="editor-tabpanel"
            >
              <div className="cover-card">
                <div className="cover-preview">
                  {cover ? (
                    <img src={cover.dataUrl} alt={t("editor.artwork")} />
                  ) : (
                    <span className="cover-placeholder">
                      {coverLoading ? (
                        <SpinnerIcon
                          className="spin"
                          width={20}
                          height={20}
                        />
                      ) : (
                        <ImageIcon width={26} height={26} />
                      )}
                    </span>
                  )}
                </div>

                <div className="cover-info">
                  <strong>{t("editor.artwork")}</strong>
                  <span>
                    {coverLoading
                      ? t("editor.coverLoading")
                      : cover
                        ? t("editor.artworkHint", {
                            size: formatBytes(cover.sizeBytes),
                          })
                        : t("editor.artworkEmpty")}
                  </span>
                  <div className="cover-actions">
                    <button
                      type="button"
                      className="btn btn--subtle"
                      onClick={() => void handleChooseCover()}
                      disabled={saving || coverBusy}
                    >
                      {coverBusy ? (
                        <SpinnerIcon className="spin" width={15} height={15} />
                      ) : (
                        <ImageIcon width={15} height={15} />
                      )}
                      {t("editor.changeCover")}
                    </button>
                    {cover && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={handleRemoveCover}
                        disabled={saving || coverBusy}
                      >
                        <TrashIcon width={15} height={15} />
                        {t("editor.removeCover")}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-grid">
                <Field
                  id="tag-title"
                  label={t("editor.fieldTitle")}
                  className="span-2"
                >
                  <input
                    id="tag-title"
                    value={draft.title}
                    onChange={(event) => update("title", event.target.value)}
                    placeholder={t("editor.placeholderTitle")}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                <Field id="tag-artist" label={t("editor.fieldArtist")}>
                  <input
                    id="tag-artist"
                    value={draft.artist}
                    onChange={(event) => update("artist", event.target.value)}
                    placeholder={t("editor.placeholderArtist")}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                <Field id="tag-album" label={t("editor.fieldAlbum")}>
                  <input
                    id="tag-album"
                    value={draft.album}
                    onChange={(event) => update("album", event.target.value)}
                    placeholder={t("editor.placeholderAlbum")}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  id="tag-album-artist"
                  label={t("editor.fieldAlbumArtist")}
                >
                  <input
                    id="tag-album-artist"
                    value={draft.albumArtist}
                    onChange={(event) =>
                      update("albumArtist", event.target.value)
                    }
                    placeholder={t("editor.placeholderAlbumArtist")}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                <Field id="tag-genre" label={t("editor.fieldGenre")}>
                  <input
                    id="tag-genre"
                    value={draft.genre}
                    onChange={(event) => update("genre", event.target.value)}
                    placeholder={t("editor.placeholderGenre")}
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

                <div className="form-meta-row form-meta-row--numeric span-2">
                  <Field
                    id="tag-year"
                    label={t("editor.fieldYear")}
                    className="field--short"
                    error={fieldErrors.year ? t("validation.year") : undefined}
                  >
                    <input
                      id="tag-year"
                      value={draft.year}
                      onChange={(event) =>
                        update("year", event.target.value.replace(/\D/g, ""))
                      }
                      placeholder={t("editor.placeholderYear")}
                      inputMode="numeric"
                      maxLength={4}
                      autoComplete="off"
                      aria-invalid={Boolean(fieldErrors.year)}
                      aria-describedby={
                        fieldErrors.year ? "tag-year-help" : undefined
                      }
                    />
                  </Field>

                  <Field
                    id="tag-track"
                    label={t("editor.fieldTrack")}
                    className="field--short"
                    error={
                      fieldErrors.track ? t("validation.track") : undefined
                    }
                  >
                    <input
                      id="tag-track"
                      value={draft.track}
                      onChange={(event) =>
                        update("track", event.target.value.replace(/\D/g, ""))
                      }
                      placeholder={t("editor.placeholderTrack")}
                      inputMode="numeric"
                      maxLength={4}
                      autoComplete="off"
                      aria-invalid={Boolean(fieldErrors.track)}
                      aria-describedby={
                        fieldErrors.track ? "tag-track-help" : undefined
                      }
                    />
                  </Field>

                  <Field
                    id="tag-track-total"
                    label={t("editor.fieldTrackTotal")}
                    className="field--short"
                    error={
                      fieldErrors.trackTotal
                        ? t("validation.trackTotal")
                        : undefined
                    }
                  >
                    <input
                      id="tag-track-total"
                      value={draft.trackTotal}
                      onChange={(event) =>
                        update(
                          "trackTotal",
                          event.target.value.replace(/\D/g, ""),
                        )
                      }
                      placeholder={t("editor.placeholderTrackTotal")}
                      inputMode="numeric"
                      maxLength={4}
                      autoComplete="off"
                      aria-invalid={Boolean(fieldErrors.trackTotal)}
                      aria-describedby={
                        fieldErrors.trackTotal
                          ? "tag-track-total-help"
                          : undefined
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
                    <strong>{t("editor.mbTitle")}</strong>
                    <span>{t("editor.mbHint")}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--subtle"
                  onClick={() => setLookupOpen(true)}
                >
                  {t("editor.lookup")}
                </button>
              </div>
            </div>
          )}

          {activeTab === "lyrics" && (
            <div
              id="editor-panel-lyrics"
              role="tabpanel"
              aria-labelledby="editor-tab-lyrics"
              className="editor-tabpanel"
            >
              <div className="lyrics-bar">
                <span>
                  {t("editor.lyricsStats", {
                    lines: lyricsLines,
                    chars: lyricsChars,
                  })}
                </span>
              </div>
              <textarea
                id="tag-lyrics"
                className="lyrics-input"
                value={draft.lyrics}
                onChange={(event) => update("lyrics", event.target.value)}
                placeholder={t("editor.placeholderLyrics")}
                aria-label={t("editor.fieldLyrics")}
                spellCheck={false}
              />
            </div>
          )}

          {activeTab === "details" && (
            <div
              id="editor-panel-details"
              role="tabpanel"
              aria-labelledby="editor-tab-details"
              className="editor-tabpanel"
            >
              <div className="form-grid">
                <div className="form-meta-row form-meta-row--duo span-2">
                  <Field
                    id="tag-disc"
                    label={t("editor.fieldDisc")}
                    className="field--short"
                    error={fieldErrors.disc ? t("validation.disc") : undefined}
                  >
                    <input
                      id="tag-disc"
                      value={draft.disc}
                      onChange={(event) =>
                        update("disc", event.target.value.replace(/\D/g, ""))
                      }
                      placeholder={t("editor.placeholderDisc")}
                      inputMode="numeric"
                      maxLength={4}
                      autoComplete="off"
                      aria-invalid={Boolean(fieldErrors.disc)}
                      aria-describedby={
                        fieldErrors.disc ? "tag-disc-help" : undefined
                      }
                    />
                  </Field>

                  <Field
                    id="tag-disc-total"
                    label={t("editor.fieldDiscTotal")}
                    className="field--short"
                    error={
                      fieldErrors.discTotal
                        ? t("validation.discTotal")
                        : undefined
                    }
                  >
                    <input
                      id="tag-disc-total"
                      value={draft.discTotal}
                      onChange={(event) =>
                        update(
                          "discTotal",
                          event.target.value.replace(/\D/g, ""),
                        )
                      }
                      placeholder={t("editor.placeholderDiscTotal")}
                      inputMode="numeric"
                      maxLength={4}
                      autoComplete="off"
                      aria-invalid={Boolean(fieldErrors.discTotal)}
                      aria-describedby={
                        fieldErrors.discTotal
                          ? "tag-disc-total-help"
                          : undefined
                      }
                    />
                  </Field>
                </div>

                <Field
                  id="tag-composer"
                  label={t("editor.fieldComposer")}
                >
                  <input
                    id="tag-composer"
                    value={draft.composer}
                    onChange={(event) =>
                      update("composer", event.target.value)
                    }
                    placeholder={t("editor.placeholderComposer")}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                <Field id="tag-label" label={t("editor.fieldLabel")}>
                  <input
                    id="tag-label"
                    value={draft.label}
                    onChange={(event) => update("label", event.target.value)}
                    placeholder={t("editor.placeholderLabel")}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  id="tag-isrc"
                  label={t("editor.fieldIsrc")}
                >
                  <input
                    id="tag-isrc"
                    value={draft.isrc}
                    onChange={(event) => update("isrc", event.target.value)}
                    placeholder={t("editor.placeholderIsrc")}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  id="tag-catalog"
                  label={t("editor.fieldCatalog")}
                >
                  <input
                    id="tag-catalog"
                    value={draft.catalogNumber}
                    onChange={(event) =>
                      update("catalogNumber", event.target.value)
                    }
                    placeholder={t("editor.placeholderCatalog")}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  id="tag-bpm"
                  label={t("editor.fieldBpm")}
                  error={fieldErrors.bpm ? t("validation.bpm") : undefined}
                >
                  <input
                    id="tag-bpm"
                    value={draft.bpm}
                    onChange={(event) =>
                      update("bpm", event.target.value.replace(/\D/g, ""))
                    }
                    placeholder={t("editor.placeholderBpm")}
                    inputMode="numeric"
                    maxLength={3}
                    autoComplete="off"
                    aria-invalid={Boolean(fieldErrors.bpm)}
                    aria-describedby={
                      fieldErrors.bpm ? "tag-bpm-help" : undefined
                    }
                  />
                </Field>

                <Field
                  id="tag-language"
                  label={t("editor.fieldLanguage")}
                >
                  <input
                    id="tag-language"
                    value={draft.language}
                    onChange={(event) =>
                      update("language", event.target.value)
                    }
                    placeholder={t("editor.placeholderLanguage")}
                    autoComplete="off"
                    spellCheck={false}
                    list="language-suggestions"
                  />
                  <datalist id="language-suggestions">
                    {LANGUAGE_SUGGESTIONS.map((language) => (
                      <option key={language} value={language} />
                    ))}
                  </datalist>
                </Field>

                <Field
                  id="tag-grouping"
                  label={t("editor.fieldGrouping")}
                  className="span-2"
                >
                  <input
                    id="tag-grouping"
                    value={draft.grouping}
                    onChange={(event) =>
                      update("grouping", event.target.value)
                    }
                    placeholder={t("editor.placeholderGrouping")}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  id="tag-copyright"
                  label={t("editor.fieldCopyright")}
                  className="span-2"
                >
                  <input
                    id="tag-copyright"
                    value={draft.copyright}
                    onChange={(event) =>
                      update("copyright", event.target.value)
                    }
                    placeholder={t("editor.placeholderCopyright")}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>

                <Field
                  id="tag-comment"
                  label={t("editor.fieldComment")}
                  className="span-2"
                >
                  <textarea
                    id="tag-comment"
                    value={draft.comment}
                    onChange={(event) =>
                      update("comment", event.target.value)
                    }
                    placeholder={t("editor.placeholderComment")}
                    rows={3}
                    spellCheck={false}
                  />
                </Field>
              </div>
            </div>
          )}
          </div>
        </div>

        <footer className="editor-foot">
          <span
            className={`dirty-state${dirty ? " is-dirty" : ""}`}
            aria-live="polite"
          >
            <span className="dirty-dot" />
            {dirty ? t("editor.dirty") : t("editor.clean")}
          </span>

          <div className="editor-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={resetDraft}
              disabled={!dirty || saving}
            >
              <UndoIcon width={16} height={16} />
              {t("editor.reset")}
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!dirty || saving}
              title={t("editor.saveTitle")}
            >
              {saving ? (
                <SpinnerIcon className="spin" width={16} height={16} />
              ) : (
                <SaveIcon width={16} height={16} />
              )}
              {saving ? t("editor.saving") : t("editor.save")}
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
