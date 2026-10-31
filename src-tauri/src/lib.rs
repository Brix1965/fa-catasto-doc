//! Fa.Catasto.Doc: la logica sta tutta nel frontend (TypeScript); qui si registrano solo i plugin.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("errore nell'avvio di Fa.Catasto.Doc");
}
