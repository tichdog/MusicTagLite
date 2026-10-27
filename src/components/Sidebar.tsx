import type { Track } from "../types";
import { formatLabel, trackHeading, trackSubheading } from "../lib/format";
import { MusicIcon, PlusIcon, ShieldIcon, SpinnerIcon } from "./Icons";

interface SidebarProps {
  tracks: Track[];
  selectedPath: string | null;
  isLoading: boolean;
  onAdd: () => void;
  onSelect: (path: string) => void;
}

export function Sidebar({
  tracks,
  selectedPath,
  isLoading,
  onAdd,
  onSelect,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <MusicIcon width={20} height={20} />
        </div>
        <div className="brand-text">
          <span className="brand-name">MusicTag</span>
          <span className="brand-lite">Lite</span>
        </div>
      </div>

      <button
        type="button"
        className="add-tracks-button"
        onClick={onAdd}
        disabled={isLoading}
      >
        {isLoading ? (
          <SpinnerIcon className="spin" width={17} height={17} />
        ) : (
          <PlusIcon width={17} height={17} />
        )}
        <span>{isLoading ? "Adding tracks…" : "Add tracks"}</span>
      </button>

      <div className="list-heading">
        <span>Tracks</span>
        <span className="track-count">{tracks.length}</span>
      </div>

      <div className="track-list" role="list">
        {tracks.length === 0 ? (
          <div className="track-list-empty">
            <span>Nothing here yet.</span>
            <span>Add a few audio files to begin.</span>
          </div>
        ) : (
          tracks.map((track) => {
            const active = track.path === selectedPath;
            return (
              <button
                key={track.path}
                type="button"
                role="listitem"
                className={`track-row${active ? " is-active" : ""}`}
                onClick={() => onSelect(track.path)}
                title={track.path}
                aria-current={active ? "true" : undefined}
              >
                <span
                  className="format-tile"
                  data-format={track.format.toLowerCase()}
                  aria-hidden="true"
                >
                  {formatLabel(track.format)}
                </span>
                <span className="track-row-text">
                  <span className="track-row-title">{trackHeading(track)}</span>
                  <span className="track-row-sub">{trackSubheading(track)}</span>
                </span>
                {track.tags.year !== null && (
                  <span className="track-row-year">{track.tags.year}</span>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="sidebar-footer">
        <ShieldIcon width={15} height={15} />
        <span>Tags are written directly to your files</span>
      </div>
    </aside>
  );
}
