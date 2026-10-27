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

### Windows

- Install the **Visual Studio Build Tools 2022** with the
  “Desktop development with C++” workload (MSVC + Windows SDK).
- Install Rust with the MSVC toolchain:

  ```powershell
  winget install Rustlang.Rustup
  rustup default stable-msvc
  ```

- WebView2 is preinstalled on Windows 10/11. Windows 7/8 need the
  [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

### Linux

Install the Tauri system dependencies for your distribution.

Debian / Ubuntu:

```bash
sudo apt update
sudo apt install -y \
  build-essential curl wget file \
  libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev \
  libxdo-dev libssl-dev patchelf libfuse2
```

Fedora:

```bash
sudo dnf install \
  webkit2gtk4.1-devel gtk3-devel \
  libappindicator-gtk3-devel librsvg2-devel \
  libxdo-devel openssl-devel patchelf fuse-libs
```

Arch Linux:

```bash
sudo pacman -S --needed \
  base-devel curl wget file \
  webkit2gtk-4.1 gtk3 libappindicator-gtk3 \
  librsvg xdotool openssl patchelf fuse2
```

## Development

```bash
# Frontend
npm install
npm run dev

# Backend (hot recompile via tauri dev)
npm run tauri dev
```

## Build

### Windows

```powershell
npm ci
npm run tauri build
```

Outputs:

- `src-tauri/target/release/musictag-lite.exe`
- `src-tauri/target/release/bundle/msi/*.msi`
- `src-tauri/target/release/bundle/nsis/*-setup.exe`

### Linux

```bash
npm ci
npm run tauri build -- --bundles deb,appimage
```

Outputs:

- `src-tauri/target/release/bundle/deb/*.deb`
- `src-tauri/target/release/bundle/appimage/*.AppImage`

Run the AppImage with `--appimage-extract-and-run` if FUSE is unavailable.

> Build on the oldest Linux distribution you intend to support. AppImage/deb
> binaries link against the glibc version of the build machine.

### CI

`.github/workflows/build.yml` builds Windows (MSI/NSIS) and Linux
(deb/AppImage) installers on every push to `master`/`main`, every pull request,
and on manual dispatch. The installers are uploaded as workflow artifacts.

Builds are unsigned. For public releases, consider Windows code signing and
publishing checksums for the Linux artifacts.

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
