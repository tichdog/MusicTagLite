use crate::error::AppError;
use crate::models::{LoadTracksResult, MusicBrainzResult, SaveTrackRequest, Track};
use crate::{musicbrainz, tags};

/// Loads one or more files in a blocking worker so large files do not stall the
/// UI thread. Individual failures are reported in `LoadTracksResult::errors`.
#[tauri::command]
pub async fn load_tracks(paths: Vec<String>) -> Result<LoadTracksResult, AppError> {
    tauri::async_runtime::spawn_blocking(move || tags::load_tracks(&paths))
        .await
        .map_err(|error| AppError::Message(format!("Loading files failed: {error}")))
}

/// Writes the edited tag fields to the original file and returns the refreshed
/// track metadata.
#[tauri::command]
pub async fn save_track(request: SaveTrackRequest) -> Result<Track, AppError> {
    tauri::async_runtime::spawn_blocking(move || tags::save_track(&request))
        .await
        .map_err(|error| AppError::Message(format!("Saving the file failed: {error}")))?
}

/// Searches MusicBrainz for recordings matching the supplied free-text query.
#[tauri::command]
pub async fn search_musicbrainz(query: String) -> Result<Vec<MusicBrainzResult>, AppError> {
    musicbrainz::search_recordings(&query).await
}
