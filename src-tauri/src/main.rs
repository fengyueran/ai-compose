use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MANAGED_BLOCK_START: &str = "<!-- BEGIN AI-COMPOSE -->";
const MANAGED_BLOCK_END: &str = "<!-- END AI-COMPOSE -->";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApplyPromptPayload {
    managed_block: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyPromptResult {
    target_path: String,
    updated_at: String,
}

#[tauri::command]
fn apply_prompt_to_user_codex(payload: ApplyPromptPayload) -> Result<ApplyPromptResult, String> {
    let target_path = resolve_codex_agents_path()?;
    let parent_directory = target_path
        .parent()
        .ok_or_else(|| "无法确定用户级 Codex 目录。".to_string())?;

    fs::create_dir_all(parent_directory)
        .map_err(|error| format!("创建用户级 Codex 目录失败：{error}"))?;

    let current_content = if target_path.exists() {
        fs::read_to_string(&target_path)
            .map_err(|error| format!("读取用户级 Codex AGENTS.md 失败：{error}"))?
    } else {
        String::new()
    };

    let next_content = upsert_managed_block(&current_content, &payload.managed_block);

    fs::write(&target_path, next_content)
        .map_err(|error| format!("写入用户级 Codex AGENTS.md 失败：{error}"))?;

    Ok(ApplyPromptResult {
        target_path: target_path.display().to_string(),
        updated_at: current_timestamp(),
    })
}

fn resolve_codex_agents_path() -> Result<PathBuf, String> {
    let home_directory =
        std::env::var("HOME").map_err(|_| "无法读取当前用户的 HOME 目录。".to_string())?;

    Ok(Path::new(&home_directory).join(".codex").join("AGENTS.md"))
}

fn upsert_managed_block(original_content: &str, managed_block: &str) -> String {
    if let Some((start, end)) = find_managed_block_range(original_content) {
        let mut next_content = String::with_capacity(
            original_content.len() - (end - start) + managed_block.len() + 1,
        );

        next_content.push_str(&original_content[..start]);
        next_content.push_str(managed_block);
        next_content.push_str(&original_content[end..]);

        return normalize_trailing_newline(&next_content);
    }

    let normalized_original = original_content.trim_end();

    if normalized_original.is_empty() {
        return format!("{managed_block}\n");
    }

    format!("{normalized_original}\n\n{managed_block}\n")
}

fn find_managed_block_range(content: &str) -> Option<(usize, usize)> {
    let start = content.find(MANAGED_BLOCK_START)?;
    let end_marker_start = content[start..].find(MANAGED_BLOCK_END)? + start;
    let end = end_marker_start + MANAGED_BLOCK_END.len();

    Some((start, end))
}

fn normalize_trailing_newline(value: &str) -> String {
    if value.ends_with('\n') {
        value.to_string()
    } else {
        format!("{value}\n")
    }
}

fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_secs().to_string(),
        Err(_) => "0".to_string(),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![apply_prompt_to_user_codex])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
