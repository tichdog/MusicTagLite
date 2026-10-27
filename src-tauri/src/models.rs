use serde::{Deserialize, Serialize};

/// The editable subset of metadata shown in the UI.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagFields {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub year: Option<u16>,
    pub genre: String,
    pub track: Option<u32>,
}

/// A loaded audio file plus its current metadata.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub path: String,
    pub file_name: String,
    pub format: String,
    pub size_bytes: u64,
    pub duration_secs: Option<u64>,
    pub tags: TagFields,
    /// Human readable tag format that was read, e.g. "ID3v2".
    pub tag_source: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileLoadError {
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadTracksResult {
    pub tracks: Vec<Track>,
    pub errors: Vec<FileLoadError>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTrackRequest {
    pub path: String,
    pub tags: TagFields,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicBrainzResult {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub year: Option<u16>,
    pub track: Option<u32>,
    pub score: Option<u32>,
    pub country: Option<String>,
}
