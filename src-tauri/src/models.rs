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
    pub album_artist: String,
    pub track_total: Option<u32>,
    pub disc: Option<u32>,
    pub disc_total: Option<u32>,
    pub composer: String,
    pub comment: String,
    pub lyrics: String,
    pub bpm: Option<u32>,
    pub isrc: String,
    pub copyright: String,
    pub language: String,
    pub grouping: String,
    pub label: String,
    pub catalog_number: String,
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
    #[serde(default)]
    pub cover: Option<CoverChange>,
}

/// A pending artwork change submitted together with the tag fields.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum CoverChange {
    /// Replace the front cover with the image at `path`.
    Set { path: String },
    /// Remove embedded artwork from the primary tag.
    Remove,
}

/// Artwork returned to the frontend as a data URL for previewing.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverArt {
    pub mime: String,
    pub data_url: String,
    pub size_bytes: u64,
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
