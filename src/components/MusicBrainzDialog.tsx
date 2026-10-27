import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MusicBrainzResult } from "../types";
import { searchMusicBrainz } from "../lib/api";
import { readError } from "../lib/errors";
import { SearchIcon, SpinnerIcon, CloseIcon } from "./Icons";

interface MusicBrainzDialogProps {
  initialTitle: string;
  initialArtist: string;
  onApply: (result: MusicBrainzResult) => void;
  onClose: () => void;
}

type SearchStatus = "idle" | "loading" | "done" | "error";

function buildQuery(title: string, artist: string): string {
  return [title.trim(), artist.trim()].filter(Boolean).join(" ");
}

export function MusicBrainzDialog({
  initialTitle,
  initialArtist,
  onApply,
  onClose,
}: MusicBrainzDialogProps) {
  const initialQuery = buildQuery(initialTitle, initialArtist);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MusicBrainzResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const autoSearched = useRef(false);

  async function runSearch(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setStatus("error");
      setError("Enter a title, artist, or album to search.");
      return;
    }

    const currentRequest = ++requestId.current;
    setStatus("loading");
    setError(null);

    try {
      const found = await searchMusicBrainz(trimmed);
      if (currentRequest !== requestId.current) {
        return;
      }
      setResults(found);
      setStatus("done");
    } catch (searchError) {
      if (currentRequest !== requestId.current) {
        return;
      }
      setStatus("error");
      setError(readError(searchError));
    }
  }

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (autoSearched.current) {
      return;
    }
    autoSearched.current = true;
    if (initialQuery) {
      void runSearch(initialQuery);
    }
    // The initial query is intentionally captured once when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="musicbrainz-title"
      >
        <header className="dialog-head">
          <div className="dialog-heading">
            <span className="dialog-kicker">Autofill</span>
            <h2 id="musicbrainz-title">MusicBrainz lookup</h2>
            <p>Pick a recording to fill the title, artist, album, year and track.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close MusicBrainz lookup"
          >
            <CloseIcon width={17} height={17} />
          </button>
        </header>

        <form className="mb-search" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="mb-query">
            Search MusicBrainz
          </label>
          <input
            ref={inputRef}
            id="mb-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Artist, title, or album"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={status === "loading"}
          >
            {status === "loading" ? (
              <SpinnerIcon className="spin" width={16} height={16} />
            ) : (
              <SearchIcon width={16} height={16} />
            )}
            Search
          </button>
        </form>

        <div className="mb-results" aria-live="polite">
          {status === "loading" && (
            <div className="mb-skeletons" aria-label="Searching MusicBrainz">
              {[0, 1, 2].map((index) => (
                <div key={index} className="mb-skeleton" />
              ))}
            </div>
          )}

          {status === "error" && (
            <div className="mb-message mb-message--error">
              <strong>Search failed</strong>
              <span>{error}</span>
            </div>
          )}

          {status === "idle" && (
            <div className="mb-message">
              <strong>Find the right release</strong>
              <span>Start with an artist and title, then narrow it down.</span>
            </div>
          )}

          {status === "done" && results.length === 0 && (
            <div className="mb-message">
              <strong>No matches found</strong>
              <span>Try a shorter query, or remove the album name.</span>
            </div>
          )}

          {status === "done" &&
            results.map((result) => {
              const meta = [
                result.album,
                result.year === null ? null : String(result.year),
                result.track === null ? null : `Track ${result.track}`,
                result.country,
              ].filter((item): item is string => Boolean(item));

              return (
                <button
                  key={result.id}
                  type="button"
                  className="mb-result"
                  onClick={() => onApply(result)}
                >
                  <span className="mb-score">
                    {result.score === null ? "—" : `${result.score}%`}
                  </span>
                  <span className="mb-result-text">
                    <span className="mb-result-title">{result.title}</span>
                    <span className="mb-result-artist">
                      {result.artist || "Unknown artist"}
                    </span>
                    {meta.length > 0 && (
                      <span className="mb-result-meta">{meta.join(" · ")}</span>
                    )}
                  </span>
                  <span className="mb-use">Use</span>
                </button>
              );
            })}
        </div>

        <footer className="dialog-foot">
          <span>Data from MusicBrainz, licensed under CC0.</span>
          <span>{results.length > 0 ? `${results.length} results` : ""}</span>
        </footer>
      </div>
    </div>
  );
}
