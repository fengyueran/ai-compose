use serde::{Deserialize, Serialize};
use std::fs;
use crate::editor::{EditorId, resolve_editor_agents_path};
use crate::utils::{
    ApplyAction, current_timestamp, normalize_trailing_newline,
    MANAGED_BLOCK_START, MANAGED_BLOCK_END,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPromptPayload {
    pub editor_id: EditorId,
    pub enabled: bool,
    pub managed_block: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPromptResult {
    pub action: ApplyAction,
    pub editor_id: EditorId,
    pub target_path: String,
    pub updated_at: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EditorTargetState {
    pub enabled: bool,
    pub target_path: String,
    pub mcp_servers: Option<serde_json::Value>,
    pub managed_mcp_servers: Option<serde_json::Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorTargetStates {
    pub antigravity: EditorTargetState,
    pub codex: EditorTargetState,
    pub cursor: EditorTargetState,
}

#[tauri::command]
pub async fn apply_prompt_to_editor_target(
    payload: ApplyPromptPayload,
) -> Result<ApplyPromptResult, String> {
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
pub async fn load_editor_target_states() -> Result<EditorTargetStates, String> {
    Ok(EditorTargetStates {
        antigravity: build_editor_target_state(EditorId::Antigravity)?,
        codex: build_editor_target_state(EditorId::Codex)?,
        cursor: build_editor_target_state(EditorId::Cursor)?,
    })
}

pub fn build_editor_target_state(editor_id: EditorId) -> Result<EditorTargetState, String> {
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
        mcp_servers: None,
        managed_mcp_servers: None,
    })
}

pub fn find_managed_block_range(content: &str) -> Option<(usize, usize)> {
    let start = content.find(MANAGED_BLOCK_START)?;
    let end_marker_start = content[start..].find(MANAGED_BLOCK_END)? + start;
    let end = end_marker_start + MANAGED_BLOCK_END.len();

    Some((start, end))
}

pub fn upsert_managed_block(original_content: &str, managed_block: &str) -> String {
    if let Some((start, end)) = find_managed_block_range(original_content) {
        let mut next_content =
            String::with_capacity(original_content.len() - (end - start) + managed_block.len() + 1);
        next_content.push_str(&original_content[..start]);
        next_content.push_str(managed_block);
        next_content.push_str(&original_content[end..]);
        return next_content;
    }

    let mut next_content = String::with_capacity(original_content.len() + managed_block.len() + 2);
    let normalized = normalize_trailing_newline(original_content);
    next_content.push_str(&normalized);
    if !normalized.is_empty() && !normalized.ends_with("\n\n") {
        next_content.push('\n');
    }
    next_content.push_str(managed_block);
    next_content.push('\n');
    next_content
}

pub fn remove_managed_block(original_content: &str) -> (ApplyAction, String) {
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

    (
        ApplyAction::Unchanged,
        normalize_trailing_newline(original_content),
    )
}
