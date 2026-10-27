# MusicTag Lite

A minimal, cross-platform desktop music tag editor built with Rust (Tauri), React and TypeScript.

## Features

- Edit title, artist, album, year, genre and track number of audio files.
- Extended metadata: album artist, track/disc totals, composer, comment, BPM, ISRC, copyright, language, grouping, label and catalog number.
- Lyrics editor for unsynchronized lyrics (USLT / LYRICS / ©lyr).
- Embedded cover art: preview, replace and remove front artwork (PNG, JPEG, GIF, BMP, TIFF; up to 10 MB).
- Tags are written **directly into the original file** — audio is never re-encoded.
- Supported formats:

  | Format | Tag style |
  | --- | --- |
  | MP3 | ID3v2 (with ID3v1 kept in sync) |
  | FLAC / OGG / Opus / Speex | Vorbis comments |
  | M4A / MP4 | MP4 `ilst` atoms |
  | WAV | ID3v2 (RIFF INFO kept in sync) |

- Optional MusicBrainz autofill (search recordings and apply metadata in one click).
- Drag & drop or picker-based file loading.
- Interface language: English or Russian (chosen in the sidebar, remembered between launches).
- Color theme: dark, light, or follow the operating system.

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [Node.js](https://nodejs.org/) 20+
- Linux only: [webkit2gtk](https://wiki.gnome.org/Projects/WebKit2GTK) and friends (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, …)

## Development

```bash
# Frontend
npm install
npm run dev

# Backend (hot recompile via tauri dev)
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

This runs `npm run build` (TypeScript + Vite) and produces the desktop binary
and installers under `src-tauri/target/release/bundle/`.

## Testing

```bash
cargo test -p musictag-lite
```

Tag read/write round-trip tests run against generated audio fixtures via the
`MUSICTAG_TEST_DIR` environment variable.

## How tagging works

- The backend uses the [Lofty](https://crates.io/crates/lofty) tag library.
- On load, the primary tag is read, falling back to the first available tag.
- On save, the primary tag is updated (created when missing) and secondary tags
  (e.g. ID3v1 for MP3, RIFF INFO for WAV) are kept in sync when present.
- Lyrics are stored as ID3v2 USLT for MP3/WAV, `LYRICS` for Vorbis comments and
  `©lyr` for MP4.
- Cover art is read from the front-cover picture (or the first available
  picture) and written as a standard embedded picture for each format.
- Fields that are left empty are cleared from the file.
- MusicBrainz queries use the official Web Service and respect its rate limits
  (a descriptive `User-Agent` is sent).
