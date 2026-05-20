use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MANAGED_BLOCK_START: &str = "<!-- BEGIN AI-COMPOSE -->";
const MANAGED_BLOCK_END: &str = "<!-- END AI-COMPOSE -->";

#[derive(Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
enum EditorId {
    Antigravity,
    Codex,
    Cursor,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApplyPromptPayload {
    editor_id: EditorId,
    enabled: bool,
    managed_block: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
enum ApplyAction {
    Removed,
    Unchanged,
    Updated,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyPromptResult {
    action: ApplyAction,
    editor_id: EditorId,
    target_path: String,
    updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EditorTargetState {
    enabled: bool,
    target_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EditorTargetStates {
    antigravity: EditorTargetState,
    codex: EditorTargetState,
    cursor: EditorTargetState,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApplyMcpPayload {
    editor_id: EditorId,
    enabled: bool,
    config_json: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplyMcpResult {
    action: ApplyAction,
    editor_id: EditorId,
    target_path: String,
    updated_at: String,
}

#[tauri::command]
fn apply_prompt_to_editor_target(payload: ApplyPromptPayload) -> Result<ApplyPromptResult, String> {
    let target_path = resolve_editor_agents_path(payload.editor_id)?;
    let parent_directory = target_path
        .parent()
        .ok_or_else(|| "无法确定编辑器目标目录。".to_string())?;

    fs::create_dir_all(parent_directory)
        .map_err(|error| format!("创建编辑器目标目录失败：{error}"))?;

    let current_content = if target_path.exists() {
        fs::read_to_string(&target_path)
            .map_err(|error| format!("读取编辑器目标 AGENTS.md 失败：{error}"))?
    } else {
        String::new()
    };

    let (action, next_content) = if payload.enabled {
        (
            ApplyAction::Updated,
            upsert_managed_block(&current_content, &payload.managed_block),
        )
    } else {
        remove_managed_block(&current_content)
    };

    fs::write(&target_path, next_content)
        .map_err(|error| format!("写入编辑器目标 AGENTS.md 失败：{error}"))?;

    Ok(ApplyPromptResult {
        action,
        editor_id: payload.editor_id,
        target_path: target_path.display().to_string(),
        updated_at: current_timestamp(),
    })
}

#[tauri::command]
fn load_editor_target_states() -> Result<EditorTargetStates, String> {
    Ok(EditorTargetStates {
        antigravity: build_editor_target_state(EditorId::Antigravity)?,
        codex: build_editor_target_state(EditorId::Codex)?,
        cursor: build_editor_target_state(EditorId::Cursor)?,
    })
}

#[tauri::command]
fn load_editor_mcp_states() -> Result<EditorTargetStates, String> {
    Ok(EditorTargetStates {
        antigravity: build_editor_mcp_state(EditorId::Antigravity)?,
        codex: build_editor_mcp_state(EditorId::Codex)?,
        cursor: build_editor_mcp_state(EditorId::Cursor)?,
    })
}

#[tauri::command]
fn apply_mcp_to_editor_target(payload: ApplyMcpPayload) -> Result<ApplyMcpResult, String> {
    let target_path = resolve_editor_mcp_path(payload.editor_id)?;
    let parent_directory = target_path
        .parent()
        .ok_or_else(|| "无法确定编辑器目标目录。".to_string())?;

    fs::create_dir_all(parent_directory)
        .map_err(|error| format!("创建编辑器目标目录失败：{error}"))?;

    let (action, next_content) = if payload.enabled {
        let parsed: serde_json::Value = serde_json::from_str(&payload.config_json)
            .map_err(|error| format!("非法的 MCP JSON 配置：{error}"))?;
        let pretty_json = serde_json::to_string_pretty(&parsed)
            .map_err(|error| format!("格式化 MCP JSON 失败：{error}"))?;
        (ApplyAction::Updated, pretty_json)
    } else {
        let empty_config = serde_json::json!({
            "mcpServers": {}
        });
        let empty_json = serde_json::to_string_pretty(&empty_config).unwrap();
        (ApplyAction::Removed, empty_json)
    };

    fs::write(&target_path, next_content)
        .map_err(|error| format!("写入编辑器目标 MCP 配置失败：{error}"))?;

    Ok(ApplyMcpResult {
        action,
        editor_id: payload.editor_id,
        target_path: target_path.display().to_string(),
        updated_at: current_timestamp(),
    })
}

fn resolve_editor_agents_path(editor_id: EditorId) -> Result<PathBuf, String> {
    match editor_id {
        EditorId::Antigravity => resolve_antigravity_agents_path(),
        EditorId::Codex => resolve_codex_agents_path(),
        EditorId::Cursor => resolve_cursor_agents_path(),
    }
}

fn resolve_editor_mcp_path(editor_id: EditorId) -> Result<PathBuf, String> {
    let home_directory = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "无法读取当前用户的 HOME 目录。".to_string())?;
    let home_path = Path::new(&home_directory);

    match editor_id {
        EditorId::Antigravity => {
            Ok(home_path.join(".gemini").join("mcp.json"))
        }
        EditorId::Codex => {
            Ok(home_path.join(".codex").join("mcp.json"))
        }
        EditorId::Cursor => {
            #[cfg(target_os = "macos")]
            {
                Ok(home_path.join("Library").join("Application Support").join("Cursor").join("User").join("global-copilot-mcp"))
            }
            #[cfg(target_os = "windows")]
            {
                if let Ok(appdata) = std::env::var("APPDATA") {
                    Ok(PathBuf::from(appdata).join("Cursor").join("User").join("global-copilot-mcp"))
                } else {
                    Ok(home_path.join("AppData").join("Roaming").join("Cursor").join("User").join("global-copilot-mcp"))
                }
            }
            #[cfg(not(any(target_os = "macos", target_os = "windows")))]
            {
                Ok(home_path.join(".config").join("Cursor").join("User").join("global-copilot-mcp"))
            }
        }
    }
}

fn resolve_antigravity_agents_path() -> Result<PathBuf, String> {
    let home_directory =
        std::env::var("HOME").map_err(|_| "无法读取当前用户的 HOME 目录。".to_string())?;

    Ok(Path::new(&home_directory).join(".gemini").join("GEMINI.md"))
}

fn resolve_codex_agents_path() -> Result<PathBuf, String> {
    let home_directory =
        std::env::var("HOME").map_err(|_| "无法读取当前用户的 HOME 目录。".to_string())?;

    Ok(Path::new(&home_directory).join(".codex").join("AGENTS.md"))
}

fn resolve_cursor_agents_path() -> Result<PathBuf, String> {
    let home_directory =
        std::env::var("HOME").map_err(|_| "无法读取当前用户的 HOME 目录。".to_string())?;

    Ok(Path::new(&home_directory).join(".cursor").join("AGENTS.md"))
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

fn remove_managed_block(original_content: &str) -> (ApplyAction, String) {
    if let Some((start, end)) = find_managed_block_range(original_content) {
        let before = original_content[..start].trim_end();
        let after = original_content[end..].trim_start();

        let next_content = match (before.is_empty(), after.is_empty()) {
            (true, true) => String::new(),
            (false, true) => format!("{before}\n"),
            (true, false) => format!("{after}\n"),
            (false, false) => format!("{before}\n\n{after}\n"),
        };

        return (ApplyAction::Removed, next_content);
    }

    (ApplyAction::Unchanged, normalize_trailing_newline(original_content))
}

fn build_editor_target_state(editor_id: EditorId) -> Result<EditorTargetState, String> {
    let target_path = resolve_editor_agents_path(editor_id)?;
    let enabled = if target_path.exists() {
        let content = fs::read_to_string(&target_path)
            .map_err(|error| format!("读取编辑器目标状态失败：{error}"))?;
        find_managed_block_range(&content).is_some()
    } else {
        false
    };

    Ok(EditorTargetState {
        enabled,
        target_path: target_path.display().to_string(),
    })
}

fn build_editor_mcp_state(editor_id: EditorId) -> Result<EditorTargetState, String> {
    let target_path = resolve_editor_mcp_path(editor_id)?;
    let enabled = if target_path.exists() {
        let content = fs::read_to_string(&target_path)
            .map_err(|error| format!("读取编辑器目标 MCP 配置失败：{error}"))?;
        
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(servers) = parsed.get("mcpServers") {
                if let Some(obj) = servers.as_object() {
                    !obj.is_empty()
                } else {
                    false
                }
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    };

    Ok(EditorTargetState {
        enabled,
        target_path: target_path.display().to_string(),
    })
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
        .invoke_handler(tauri::generate_handler![
            apply_prompt_to_editor_target,
            load_editor_target_states,
            load_editor_mcp_states,
            apply_mcp_to_editor_target
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
