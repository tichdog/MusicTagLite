import { PlusIcon, SpinnerIcon } from "./Icons";

interface EmptyStateProps {
  isLoading: boolean;
  onAdd: () => void;
}

const FORMATS = ["MP3", "FLAC", "OGG", "M4A", "WAV"];

export function EmptyState({ isLoading, onAdd }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-halo" aria-hidden="true">
        <div className="empty-disc">
          <div className="empty-disc-label">♫</div>
        </div>
      </div>

      <p className="eyebrow">A tiny tag editor</p>
      <h1>Your music, properly tagged.</h1>
      <p className="empty-copy">
        Open audio files, fix their metadata, and save the changes straight back
        to disk. No re-encoding, no library, no fuss.
      </p>

      <button
        type="button"
        className="btn btn--primary btn--large"
        onClick={onAdd}
        disabled={isLoading}
      >
        {isLoading ? (
          <SpinnerIcon className="spin" width={18} height={18} />
        ) : (
          <PlusIcon width={18} height={18} />
        )}
        {isLoading ? "Adding tracks…" : "Choose audio files"}
      </button>

      <p className="drop-hint">…or drop files anywhere in this window</p>

      <div className="format-chips" aria-label="Supported formats">
        {FORMATS.map((format) => (
          <span key={format} className="format-chip">
            {format}
          </span>
        ))}
      </div>
    </section>
  );
}
