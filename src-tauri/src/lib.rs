mod commands;
mod error;
mod models;
mod musicbrainz;
mod tags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::load_tracks,
            commands::save_track,
            commands::search_musicbrainz
        ])
        .run(tauri::generate_context!())
        .expect("error while running MusicTag Lite");
}
