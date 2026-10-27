import { useSettings } from "../settings";
import { PlusIcon, SpinnerIcon } from "./Icons";

interface EmptyStateProps {
  isLoading: boolean;
  onAdd: () => void;
}

const FORMATS = ["MP3", "FLAC", "OGG", "M4A", "WAV"];

export function EmptyState({ isLoading, onAdd }: EmptyStateProps) {
  const { t } = useSettings();

  return (
    <section className="empty-state">
      <div className="empty-halo" aria-hidden="true">
        <div className="empty-disc">
          <div className="empty-disc-label">♫</div>
        </div>
      </div>

      <p className="eyebrow">{t("empty.eyebrow")}</p>
      <h1>{t("empty.title")}</h1>
      <p className="empty-copy">{t("empty.copy")}</p>

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
        {isLoading ? t("sidebar.adding") : t("empty.choose")}
      </button>

      <p className="drop-hint">{t("empty.dropHint")}</p>

      <div className="format-chips" aria-label={t("empty.supportedFormats")}>
        {FORMATS.map((format) => (
          <span key={format} className="format-chip">
            {format}
          </span>
        ))}
      </div>
    </section>
  );
}
