use std::borrow::Cow;
use std::collections::HashSet;
use std::ffi::OsStr;
use std::fs;
use std::path::Path;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, FileType, TaggedFile, TaggedFileExt};
use lofty::picture::{Picture, PictureType};
use lofty::probe::Probe;
use lofty::tag::items::Timestamp;
use lofty::tag::{Accessor, ItemKey, Tag, TagExt, TagType};

use crate::error::{AppError, AppResult};
use crate::models::{
    CoverArt, CoverChange, FileLoadError, LoadTracksResult, SaveTrackRequest, TagFields,
    Track,
};

const MAX_COVER_BYTES: u64 = 10 * 1024 * 1024;

/// Reads every requested file, reporting per-file failures instead of failing
/// the whole batch. Paths are deduplicated while preserving their order.
pub fn load_tracks(paths: &[String]) -> LoadTracksResult {
    let mut seen = HashSet::new();
    let mut tracks = Vec::new();
    let mut errors = Vec::new();

    for path in paths {
        if path.trim().is_empty() || !seen.insert(path.clone()) {
            continue;
        }

        match read_track(path) {
            Ok(track) => tracks.push(track),
            Err(error) => errors.push(FileLoadError {
                path: path.clone(),
                message: error.to_string(),
            }),
        }
    }

    LoadTracksResult { tracks, errors }
}

/// Reads metadata and audio properties for a single file.
pub fn read_track(path: impl AsRef<Path>) -> AppResult<Track> {
    let path = path.as_ref();
    let metadata = fs::metadata(path)?;

    if !metadata.is_file() {
        return Err(AppError::Invalid(format!(
            "{} is not a regular file",
            path.display()
        )));
    }

    let tagged_file = Probe::open(path)?.read()?;
    let tag = select_tag(&tagged_file);

    Ok(Track {
        path: path.to_string_lossy().into_owned(),
        file_name: path
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or_default()
            .to_string(),
        format: format_label(path, tagged_file.file_type()),
        size_bytes: metadata.len(),
        duration_secs: duration_secs(&tagged_file),
        tags: tag.map(read_fields).unwrap_or_default(),
        tag_source: tag.map(|tag| tag_source(tag.tag_type()).to_string()),
    })
}

/// Writes the given fields to the file's primary tag (creating it when needed).
/// For MP3 files an existing ID3v1 tag is kept in sync with the ID3v2 tag.
pub fn save_track(request: &SaveTrackRequest) -> AppResult<Track> {
    let path = Path::new(&request.path);
    let metadata = fs::metadata(path)?;

    if !metadata.is_file() {
        return Err(AppError::Invalid(format!(
            "{} is not a regular file",
            path.display()
        )));
    }

    let mut tagged_file = Probe::open(path)?.read()?;
    let file_type = tagged_file.file_type();
    let primary = file_type.primary_tag_type();
    let had_primary = tagged_file.tag(primary).is_some();
    let has_cover_set = matches!(request.cover, Some(CoverChange::Set { .. }));
    let has_content = !fields_are_empty(&request.tags) || has_cover_set;

    if !had_primary && has_content {
        let _ = tagged_file.insert_tag(Tag::new(primary));
    }

    if let Some(tag) = tagged_file.tag_mut(primary) {
        apply_fields(tag, &request.tags);

        if let Some(change) = &request.cover {
            apply_cover(tag, change)?;
        }
    }

    // Keep secondary tags in sync so other players that prefer an older tag
    // format don't continue to show stale metadata.
    for &secondary in secondary_tag_types(file_type, primary) {
        if tagged_file.contains_tag_type(secondary) {
            if let Some(tag) = tagged_file.tag_mut(secondary) {
                apply_fields(tag, &request.tags);
            }
        }
    }

    // Drop a primary tag that became completely empty, unless it still holds
    // pictures or other metadata the editor does not expose.
    if had_primary && !has_content {
        let primary_is_empty = tagged_file
            .tag(primary)
            .is_some_and(TagExt::is_empty);

        if primary_is_empty {
            tagged_file.remove(primary);
        }
    }

    tagged_file.save_to_path(path, WriteOptions::default())?;

    read_track(path)
}

/// Reads embedded front cover artwork, falling back to the first picture.
pub fn read_cover(path: impl AsRef<Path>) -> AppResult<Option<CoverArt>> {
    let tagged_file = Probe::open(path.as_ref())?.read()?;
    let Some(tag) = select_tag(&tagged_file) else {
        return Ok(None);
    };

    let picture = tag
        .pictures()
        .iter()
        .find(|picture| picture.pic_type() == PictureType::CoverFront)
        .or_else(|| tag.pictures().first());

    Ok(picture.map(cover_from_picture))
}

/// Reads a standalone image file so the UI can preview a pending cover change.
pub fn preview_image(path: impl AsRef<Path>) -> AppResult<CoverArt> {
    let picture = read_picture(path.as_ref())?;
    Ok(cover_from_picture(&picture))
}

fn cover_from_picture(picture: &Picture) -> CoverArt {
    let mime = picture
        .mime_type()
        .map(|mime| mime.as_str().to_string())
        .or_else(|| detect_mime(picture.data()))
        .unwrap_or_else(|| "application/octet-stream".to_string());

    CoverArt {
        data_url: format!("data:{mime};base64,{}", BASE64.encode(picture.data())),
        mime,
        size_bytes: picture.data().len() as u64,
    }
}

fn detect_mime(data: &[u8]) -> Option<String> {
    let mut reader = data;
    Picture::from_reader(&mut reader)
        .ok()
        .and_then(|picture| picture.mime_type().cloned())
        .map(|mime| mime.as_str().to_string())
}

fn read_picture(path: &Path) -> AppResult<Picture> {
    let metadata = fs::metadata(path)?;

    if !metadata.is_file() {
        return Err(AppError::Invalid(format!(
            "{} is not a regular image file",
            path.display()
        )));
    }

    if metadata.len() > MAX_COVER_BYTES {
        return Err(AppError::Invalid(format!(
            "Cover image is too large ({} MB). The limit is {} MB.",
            metadata.len() / (1024 * 1024),
            MAX_COVER_BYTES / (1024 * 1024)
        )));
    }

    let mut file = fs::File::open(path)?;
    let mut picture = Picture::from_reader(&mut file).map_err(|error| {
        AppError::Invalid(format!("Unsupported image format: {error}"))
    })?;
    picture.set_pic_type(PictureType::CoverFront);

    Ok(picture)
}

fn apply_cover(tag: &mut Tag, change: &CoverChange) -> AppResult<()> {
    match change {
        CoverChange::Set { path } => {
            let picture = read_picture(Path::new(path))?;
            tag.remove_picture_type(PictureType::CoverFront);
            tag.push_picture(picture);
        }
        CoverChange::Remove => {
            while tag.picture_count() > 0 {
                let _ = tag.remove_picture(0);
            }
        }
    }

    Ok(())
}

fn fields_are_empty(fields: &TagFields) -> bool {
    fields.title.is_empty()
        && fields.artist.is_empty()
        && fields.album.is_empty()
        && fields.genre.is_empty()
        && fields.year.is_none()
        && fields.track.is_none()
        && fields.album_artist.is_empty()
        && fields.track_total.is_none()
        && fields.disc.is_none()
        && fields.disc_total.is_none()
        && fields.composer.is_empty()
        && fields.comment.is_empty()
        && fields.lyrics.is_empty()
        && fields.bpm.is_none()
        && fields.isrc.is_empty()
        && fields.copyright.is_empty()
        && fields.language.is_empty()
        && fields.grouping.is_empty()
        && fields.label.is_empty()
        && fields.catalog_number.is_empty()
}

fn secondary_tag_types(file_type: FileType, primary: TagType) -> &'static [TagType] {
    match file_type {
        // ID3v1 is common on older MP3s and is kept in sync with ID3v2.
        FileType::Mpeg if primary != TagType::Id3v1 => &[TagType::Id3v1],
        // WAV files often carry RIFF INFO metadata from other tools.
        FileType::Wav if primary != TagType::RiffInfo => &[TagType::RiffInfo],
        _ => &[],
    }
}

/// Prefer the format's primary tag, but fall back to the first non-empty tag.
/// This makes ID3v1-only MP3s readable while avoiding an empty ID3v2 tag when
/// an older tag still contains the actual metadata.
fn select_tag(tagged_file: &TaggedFile) -> Option<&Tag> {
    let primary = tagged_file.primary_tag();

    if let Some(tag) = primary.filter(|tag| !tag.is_empty()) {
        return Some(tag);
    }

    if let Some(tag) = tagged_file.tags().iter().find(|tag| !tag.is_empty()) {
        return Some(tag);
    }

    primary.or_else(|| tagged_file.first_tag())
}

fn read_fields(tag: &Tag) -> TagFields {
    let bpm_text = item_text(tag, &[ItemKey::IntegerBpm, ItemKey::Bpm]);

    TagFields {
        title: accessor_text(tag.title()),
        artist: accessor_text(tag.artist()),
        album: accessor_text(tag.album()),
        year: read_year(tag),
        genre: accessor_text(tag.genre()),
        track: tag.track().or_else(|| {
            tag.get_string(ItemKey::TrackNumber)
                .and_then(parse_leading_u32)
        }),
        album_artist: item_text(tag, &[ItemKey::AlbumArtist]),
        track_total: tag.track_total(),
        disc: tag.disk(),
        disc_total: tag.disk_total(),
        composer: item_text(tag, &[ItemKey::Composer]),
        comment: accessor_text(tag.comment()),
        lyrics: item_text(tag, &[ItemKey::Lyrics, ItemKey::UnsyncLyrics]),
        bpm: parse_leading_u32(&bpm_text).filter(|bpm| (1..=999).contains(bpm)),
        isrc: item_text(tag, &[ItemKey::Isrc]),
        copyright: item_text(tag, &[ItemKey::CopyrightMessage]),
        language: item_text(tag, &[ItemKey::Language]),
        grouping: item_text(tag, &[ItemKey::ContentGroup]),
        label: item_text(tag, &[ItemKey::Label, ItemKey::Publisher]),
        catalog_number: item_text(tag, &[ItemKey::CatalogNumber]),
    }
}

fn accessor_text(value: Option<Cow<'_, str>>) -> String {
    value.map(Cow::into_owned).unwrap_or_default()
}

fn item_text(tag: &Tag, keys: &[ItemKey]) -> String {
    for key in keys {
        if let Some(value) = tag.get_string(*key) {
            return value.to_string();
        }
    }

    String::new()
}

fn read_year(tag: &Tag) -> Option<u16> {
    tag.date()
        .map(|date| date.year)
        .filter(|year| *year > 0)
        .or_else(|| tag.get_string(ItemKey::Year).and_then(parse_year))
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

fn parse_leading_u32(value: &str) -> Option<u32> {
    let digits: String = value
        .trim()
        .chars()
        .take_while(char::is_ascii_digit)
        .collect();

    digits.parse().ok()
}

fn apply_fields(tag: &mut Tag, fields: &TagFields) {
    set_or_remove(tag, &fields.title, |tag, value| tag.set_title(value), Tag::remove_title);
    set_or_remove(
        tag,
        &fields.artist,
        |tag, value| tag.set_artist(value),
        Tag::remove_artist,
    );
    set_or_remove(tag, &fields.album, |tag, value| tag.set_album(value), Tag::remove_album);
    set_or_remove(tag, &fields.genre, |tag, value| tag.set_genre(value), Tag::remove_genre);
    set_or_remove(
        tag,
        &fields.comment,
        |tag, value| tag.set_comment(value),
        Tag::remove_comment,
    );

    match fields.year {
        Some(year) => tag.set_date(Timestamp {
            year,
            ..Timestamp::default()
        }),
        None => tag.remove_date(),
    }

    match fields.track {
        Some(track) => tag.set_track(track),
        None => tag.remove_track(),
    }

    match fields.track_total {
        Some(total) => tag.set_track_total(total),
        None => tag.remove_track_total(),
    }

    match fields.disc {
        Some(disc) => tag.set_disk(disc),
        None => tag.remove_disk(),
    }

    match fields.disc_total {
        Some(total) => tag.set_disk_total(total),
        None => tag.remove_disk_total(),
    }

    set_text_or_remove(tag, ItemKey::AlbumArtist, &fields.album_artist);
    set_text_or_remove(tag, ItemKey::Composer, &fields.composer);
    set_text_or_remove(tag, ItemKey::Isrc, &fields.isrc);
    set_text_or_remove(tag, ItemKey::CopyrightMessage, &fields.copyright);
    set_text_or_remove(tag, ItemKey::Language, &fields.language);
    set_text_or_remove(tag, ItemKey::ContentGroup, &fields.grouping);

    // ID3v2 conventionally stores the label in TPUB, which Lofty exposes as
    // Publisher; other formats have a dedicated Label field.
    let label_key = if tag.tag_type() == TagType::Id3v2 {
        ItemKey::Publisher
    } else {
        ItemKey::Label
    };
    set_text_or_remove(tag, label_key, &fields.label);
    set_text_or_remove(tag, ItemKey::CatalogNumber, &fields.catalog_number);

    // ID3v2 stores unsynchronized lyrics in USLT, while most other formats use
    // a plain Lyrics/LYRICS field.
    let lyrics_key = if tag.tag_type() == TagType::Id3v2 {
        ItemKey::UnsyncLyrics
    } else {
        ItemKey::Lyrics
    };
    set_text_or_remove(tag, lyrics_key, &fields.lyrics);

    // ID3v2 and MP4 use a dedicated integer BPM field; Vorbis/APE use a
    // generic BPM text field.
    match fields.bpm {
        Some(bpm) => {
            let key = if matches!(tag.tag_type(), TagType::Id3v2 | TagType::Mp4Ilst) {
                ItemKey::IntegerBpm
            } else {
                ItemKey::Bpm
            };
            tag.insert_text(key, bpm.to_string());
        }
        None => {
            tag.remove_key(ItemKey::IntegerBpm);
            tag.remove_key(ItemKey::Bpm);
        }
    }
}

fn set_text_or_remove(tag: &mut Tag, key: ItemKey, value: &str) {
    if value.is_empty() {
        tag.remove_key(key);
    } else {
        tag.insert_text(key, value.to_string());
    }
}

fn set_or_remove(
    tag: &mut Tag,
    value: &str,
    set: impl FnOnce(&mut Tag, String),
    remove: impl FnOnce(&mut Tag),
) {
    if value.is_empty() {
        remove(tag);
    } else {
        set(tag, value.to_string());
    }
}

fn duration_secs(tagged_file: &TaggedFile) -> Option<u64> {
    let seconds = tagged_file.properties().duration().as_secs();
    (seconds > 0).then_some(seconds)
}

fn format_label(path: &Path, file_type: FileType) -> String {
    if let Some(extension) = path.extension().and_then(OsStr::to_str) {
        if !extension.is_empty() {
            return extension.to_ascii_uppercase();
        }
    }

    match file_type {
        FileType::Aac => "AAC",
        FileType::Aiff => "AIFF",
        FileType::Ape => "APE",
        FileType::Flac => "FLAC",
        FileType::Mpeg => "MP3",
        FileType::Mp4 => "M4A",
        FileType::Mpc => "MPC",
        FileType::Opus => "OPUS",
        FileType::Vorbis => "OGG",
        FileType::Speex => "SPX",
        FileType::Wav => "WAV",
        FileType::WavPack => "WV",
        FileType::Custom(name) => name,
        _ => "AUDIO",
    }
    .to_string()
}

fn tag_source(tag_type: TagType) -> &'static str {
    match tag_type {
        TagType::Ape => "APEv2",
        TagType::Id3v1 => "ID3v1",
        TagType::Id3v2 => "ID3v2",
        TagType::Mp4Ilst => "MP4 Metadata",
        TagType::VorbisComments => "Vorbis Comments",
        TagType::RiffInfo => "RIFF INFO",
        TagType::AiffText => "AIFF Text",
        _ => "Tag",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::{Mutex, MutexGuard};

    static FIXTURE_LOCK: Mutex<()> = Mutex::new(());

    fn lock_fixtures() -> MutexGuard<'static, ()> {
        FIXTURE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    const FIXTURES: &[&str] = &[
        "sample.mp3",
        "sample.flac",
        "sample.ogg",
        "sample.m4a",
        "sample.wav",
    ];

    fn fixture_path(name: &str) -> Option<PathBuf> {
        let directory = std::env::var_os("MUSICTAG_TEST_DIR")?;
        let path = PathBuf::from(directory).join(name);
        path.is_file().then_some(path)
    }

    #[test]
    fn round_trips_supported_formats() {
        let _guard = lock_fixtures();
        let Some(first) = fixture_path(FIXTURES[0]) else {
            eprintln!("skipping: set MUSICTAG_TEST_DIR to the fixture directory");
            return;
        };
        let fixture_dir = first.parent().unwrap().to_path_buf();

        for name in FIXTURES {
            let path = fixture_dir.join(name);
            assert!(path.is_file(), "missing fixture {name}");

            let original = read_track(&path).expect("fixture should be readable");
            assert_eq!(original.tags.title, "Old Title", "{name}: title");
            assert_eq!(original.tags.artist, "Old Artist", "{name}: artist");
            assert_eq!(original.tags.album, "Old Album", "{name}: album");
            assert_eq!(original.tags.year, Some(1999), "{name}: year");
            assert_eq!(original.tags.genre, "Rock", "{name}: genre");
            assert_eq!(original.tags.track, Some(3), "{name}: track");
            assert!(original.duration_secs.is_some(), "{name}: duration");
            assert!(original.tag_source.is_some(), "{name}: tag source");

            let new_tags = TagFields {
                title: format!("New Title {name}"),
                artist: "New Artist".to_string(),
                album: "New Album".to_string(),
                year: Some(2024),
                genre: "Electronic".to_string(),
                track: Some(7),
                ..TagFields::default()
            };
            let request = SaveTrackRequest {
                path: path.to_string_lossy().into_owned(),
                tags: new_tags.clone(),
                cover: None,
            };

            let saved = save_track(&request).expect("save should succeed");
            assert_eq!(saved.tags, new_tags, "{name}: saved fields");
            assert_eq!(
                read_track(&path).expect("re-read").tags,
                new_tags,
                "{name}: persisted fields"
            );

            // Restore the fixture so the test is repeatable. Set
            // MUSICTAG_TEST_KEEP=1 to inspect the written files externally.
            if std::env::var_os("MUSICTAG_TEST_KEEP").is_none() {
                let restore = SaveTrackRequest {
                    path: request.path,
                    tags: original.tags,
                    cover: None,
                };
                save_track(&restore).expect("restore should succeed");
            }
        }
    }

    #[test]
    fn upgrades_an_id3v1_only_mp3() {
        let _guard = lock_fixtures();
        let Some(path) = fixture_path("id3v1.mp3") else {
            eprintln!("skipping: id3v1.mp3 fixture is not available");
            return;
        };

        let original = read_track(&path).expect("ID3v1 fixture should be readable");
        assert_eq!(original.tag_source.as_deref(), Some("ID3v1"));
        assert_eq!(original.tags.title, "V1 Title");
        assert_eq!(original.tags.year, Some(1988));

        let new_tags = TagFields {
            title: "Both Tags".to_string(),
            artist: "Synced Artist".to_string(),
            album: "Synced Album".to_string(),
            year: Some(2001),
            genre: "Rock".to_string(),
            track: Some(9),
            ..TagFields::default()
        };
        let request = SaveTrackRequest {
            path: path.to_string_lossy().into_owned(),
            tags: new_tags.clone(),
            cover: None,
        };

        let saved = save_track(&request).expect("save should succeed");
        assert_eq!(saved.tags, new_tags);

        let tagged_file = Probe::open(&path).unwrap().read().unwrap();
        assert!(tagged_file.contains_tag_type(TagType::Id3v2));
        assert!(tagged_file.contains_tag_type(TagType::Id3v1));

        let id3v1 = tagged_file.tag(TagType::Id3v1).expect("ID3v1 tag");
        assert_eq!(id3v1.title().as_deref(), Some("Both Tags"));
        assert_eq!(id3v1.artist().as_deref(), Some("Synced Artist"));
        assert_eq!(id3v1.album().as_deref(), Some("Synced Album"));
        assert_eq!(id3v1.track(), Some(9));

        if std::env::var_os("MUSICTAG_TEST_KEEP").is_none() {
            let restore = SaveTrackRequest {
                path: request.path,
                tags: original.tags,
                cover: None,
            };
            save_track(&restore).expect("restore should succeed");

            // Keep the fixture ID3v1-only for the next run.
            let _ = TagType::Id3v2.remove_from_path(&path, WriteOptions::default());
        }
    }

    #[test]
    fn writes_extended_fields() {
        let _guard = lock_fixtures();
        let Some(first) = fixture_path(FIXTURES[0]) else {
            return;
        };
        let fixture_dir = first.parent().unwrap().to_path_buf();

        for name in FIXTURES {
            let path = fixture_dir.join(name);
            let original = read_track(&path).expect("fixture should be readable");
            let tags = TagFields {
                title: original.tags.title.clone(),
                artist: original.tags.artist.clone(),
                album: original.tags.album.clone(),
                year: original.tags.year,
                genre: original.tags.genre.clone(),
                track: original.tags.track,
                album_artist: "Album Artist".to_string(),
                track_total: Some(12),
                disc: Some(2),
                disc_total: Some(3),
                composer: "Composer Name".to_string(),
                comment: "First comment line\nSecond comment line".to_string(),
                lyrics: "Первая строка\nSecond line\n\nThird line".to_string(),
                bpm: Some(128),
                isrc: "USRC17607839".to_string(),
                copyright: "© 2026 Test".to_string(),
                language: "eng".to_string(),
                grouping: "Group A".to_string(),
                label: "Test Label".to_string(),
                catalog_number: "CAT-001".to_string(),
            };
            let request = SaveTrackRequest {
                path: path.to_string_lossy().into_owned(),
                tags: tags.clone(),
                cover: None,
            };

            let saved = save_track(&request).expect("extended save should succeed");
            assert_eq!(saved.tags, tags, "{name}: saved fields");
            assert_eq!(
                read_track(&path).expect("re-read").tags,
                tags,
                "{name}: persisted extended fields"
            );

            if std::env::var_os("MUSICTAG_TEST_KEEP").is_none() {
                let restore = SaveTrackRequest {
                    path: request.path,
                    tags: original.tags,
                    cover: None,
                };
                save_track(&restore).expect("restore should succeed");
            }
        }
    }

    #[test]
    fn writes_and_removes_cover_art() {
        let _guard = lock_fixtures();
        let Some(first) = fixture_path(FIXTURES[0]) else {
            return;
        };
        let fixture_dir = first.parent().unwrap().to_path_buf();
        let image_path = fixture_dir.join("cover-test.png");
        let png = BASE64
            .decode(ONE_PIXEL_PNG)
            .expect("valid test PNG");
        fs::write(&image_path, &png).expect("write test image");

        for name in FIXTURES {
            let path = fixture_dir.join(name);
            let original = read_track(&path).expect("fixture should be readable");

            let clear = SaveTrackRequest {
                path: path.to_string_lossy().into_owned(),
                tags: original.tags.clone(),
                cover: Some(CoverChange::Remove),
            };
            save_track(&clear).expect("clearing artwork should succeed");
            assert!(read_cover(&path).unwrap().is_none(), "{name}: cover cleared");

            let request = SaveTrackRequest {
                path: path.to_string_lossy().into_owned(),
                tags: original.tags.clone(),
                cover: Some(CoverChange::Set {
                    path: image_path.to_string_lossy().into_owned(),
                }),
            };
            save_track(&request).expect("cover save should succeed");

            let cover = read_cover(&path)
                .expect("cover read should succeed")
                .unwrap_or_else(|| panic!("{name}: cover should exist"));
            assert_eq!(cover.mime, "image/png", "{name}: cover mime");
            assert!(cover.data_url.starts_with("data:image/png;base64,"));
            let encoded = cover.data_url.split(',').nth(1).expect("data URL payload");
            assert_eq!(
                BASE64.decode(encoded).expect("valid base64"),
                png,
                "{name}: cover bytes"
            );

            let remove = SaveTrackRequest {
                path: path.to_string_lossy().into_owned(),
                tags: original.tags,
                cover: Some(CoverChange::Remove),
            };
            save_track(&remove).expect("cover removal should succeed");
            assert!(read_cover(&path).unwrap().is_none(), "{name}: cover removed");
        }

        let _ = fs::remove_file(image_path);
    }

    const ONE_PIXEL_PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

    #[test]
    fn parses_years_and_track_numbers() {
        assert_eq!(parse_year("1999"), Some(1999));
        assert_eq!(parse_year("1999-05-03"), Some(1999));
        assert_eq!(parse_year("99"), None);
        assert_eq!(parse_year("0"), None);
        assert_eq!(parse_leading_u32("7"), Some(7));
        assert_eq!(parse_leading_u32("7/12"), Some(7));
        assert_eq!(parse_leading_u32("A1"), None);
        assert_eq!(parse_leading_u32("0"), Some(0));
    }
}

