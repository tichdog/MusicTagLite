use std::time::Duration;

use reqwest::Client;
use serde::Deserialize;

use crate::error::{AppError, AppResult};
use crate::models::MusicBrainzResult;

const USER_AGENT: &str =
    "MusicTagLite/0.1.0 (https://github.com/tichdog/MusicTagLite)";
const SEARCH_URL: &str = "https://musicbrainz.org/ws/2/recording";

#[derive(Debug, Deserialize)]
struct MbResponse {
    #[serde(default)]
    recordings: Vec<MbRecording>,
}

#[derive(Debug, Deserialize)]
struct MbRecording {
    id: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    score: Option<u32>,
    #[serde(default)]
    country: Option<String>,
    #[serde(default, rename = "first-release-date")]
    first_release_date: Option<String>,
    #[serde(default, rename = "artist-credit")]
    artist_credit: Vec<MbArtistCredit>,
    #[serde(default)]
    releases: Vec<MbRelease>,
}

#[derive(Debug, Deserialize)]
struct MbArtistCredit {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    joinphrase: Option<String>,
    #[serde(default)]
    artist: Option<MbArtist>,
}

#[derive(Debug, Deserialize)]
struct MbArtist {
    #[serde(default)]
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MbRelease {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    date: Option<String>,
    #[serde(default)]
    country: Option<String>,
    #[serde(default)]
    media: Vec<MbMedium>,
}

#[derive(Debug, Deserialize)]
struct MbMedium {
    #[serde(default)]
    tracks: Vec<MbTrack>,
}

#[derive(Debug, Deserialize)]
struct MbTrack {
    #[serde(default)]
    number: Option<String>,
}

/// Queries the MusicBrainz recording search endpoint and maps the response to
/// the small result model rendered by the lookup dialog.
pub async fn search_recordings(query: &str) -> AppResult<Vec<MusicBrainzResult>> {
    let query = query.trim();

    if query.is_empty() {
        return Err(AppError::Invalid(
            "Enter a title, artist, or album to search.".to_string(),
        ));
    }

    let client = Client::builder()
        .user_agent(USER_AGENT)
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(20))
        .build()?;

    let response = client
        .get(SEARCH_URL)
        .query(&[("query", query), ("fmt", "json"), ("limit", "15")])
        .send()
        .await?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        let detail = body.trim();
        return Err(AppError::Upstream(if detail.is_empty() {
            format!("HTTP {status}")
        } else {
            format!("HTTP {status}: {}", truncate(detail, 300))
        }));
    }

    let payload: MbResponse = response.json().await?;
    let mut results = Vec::with_capacity(payload.recordings.len());
    let mut seen = std::collections::HashSet::new();

    for recording in payload.recordings {
        if !seen.insert(recording.id.clone()) {
            continue;
        }

        let title = match recording.title.as_deref() {
            Some(title) if !title.trim().is_empty() => title.trim().to_string(),
            _ => continue,
        };

        let release = pick_release(&recording);
        let album = release
            .and_then(|release| release.title.as_deref())
            .map(str::trim)
            .filter(|title| !title.is_empty())
            .map(str::to_string);
        let year = release
            .and_then(|release| release.date.as_deref())
            .and_then(parse_year)
            .or_else(|| {
                recording
                    .first_release_date
                    .as_deref()
                    .and_then(parse_year)
            });
        let track = release.and_then(release_track_number);
        let country = release
            .and_then(|release| release.country.as_deref())
            .map(str::trim)
            .filter(|country| !country.is_empty())
            .map(str::to_string)
            .or_else(|| {
                recording
                    .country
                    .as_deref()
                    .map(str::trim)
                    .filter(|country| !country.is_empty())
                    .map(str::to_string)
            });

        results.push(MusicBrainzResult {
            id: recording.id,
            title,
            artist: artist_name(&recording.artist_credit),
            album,
            year,
            track,
            score: recording.score,
            country,
        });
    }

    Ok(results)
}

fn pick_release(recording: &MbRecording) -> Option<&MbRelease> {
    let mut with_track = recording
        .releases
        .iter()
        .filter(|release| release.title.is_some() && release_track_number(release).is_some());

    with_track
        .next()
        .or_else(|| recording.releases.iter().find(|release| release.title.is_some()))
        .or_else(|| recording.releases.first())
}

fn release_track_number(release: &MbRelease) -> Option<u32> {
    release
        .media
        .iter()
        .flat_map(|medium| medium.tracks.iter())
        .find_map(|track| track.number.as_deref().and_then(parse_track_number))
}

fn parse_track_number(value: &str) -> Option<u32> {
    let digits: String = value
        .trim()
        .chars()
        .take_while(char::is_ascii_digit)
        .collect();

    digits.parse::<u32>().ok().filter(|number| *number > 0)
}

fn parse_year(value: &str) -> Option<u16> {
    let digits: String = value
        .trim()
        .chars()
        .take_while(char::is_ascii_digit)
        .take(4)
        .collect();

    if digits.len() != 4 {
        return None;
    }

    digits.parse::<u16>().ok().filter(|year| *year > 0)
}

fn artist_name(credits: &[MbArtistCredit]) -> String {
    let mut name = String::new();

    for credit in credits {
        if let Some(credited) = credit
            .name
            .as_deref()
            .or_else(|| credit.artist.as_ref().and_then(|artist| artist.name.as_deref()))
        {
            name.push_str(credited);
        }

        if let Some(joinphrase) = credit.joinphrase.as_deref() {
            name.push_str(joinphrase);
        }
    }

    name.trim().to_string()
}

fn truncate(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars();
    let truncated: String = chars.by_ref().take(max_chars).collect();

    if chars.next().is_some() {
        format!("{truncated}…")
    } else {
        truncated
    }
}
