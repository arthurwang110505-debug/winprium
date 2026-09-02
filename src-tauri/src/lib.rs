// Tauri 由 main.rs 直接啟動即可;這裡保留給未來掛 plugin / command。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Winprium Studio");
}
