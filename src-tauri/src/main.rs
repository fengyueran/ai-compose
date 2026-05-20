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
    mcp_servers: Option<serde_json::Value>,
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

fn toml_to_json(toml: &toml::Value) -> serde_json::Value {
    match toml {
        toml::Value::String(s) => serde_json::Value::String(s.clone()),
        toml::Value::Integer(i) => serde_json::Value::Number((*i).into()),
        toml::Value::Float(f) => serde_json::Number::from_f64(*f)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        toml::Value::Boolean(b) => serde_json::Value::Bool(*b),
        toml::Value::Datetime(d) => serde_json::Value::String(d.to_string()),
        toml::Value::Array(arr) => {
            let json_arr = arr.iter().map(toml_to_json).collect();
            serde_json::Value::Array(json_arr)
        }
        toml::Value::Table(table) => {
            let mut json_obj = serde_json::Map::new();
            for (k, v) in table {
                json_obj.insert(k.clone(), toml_to_json(v));
            }
            serde_json::Value::Object(json_obj)
        }
    }
}

fn json_to_toml(json: &serde_json::Value) -> toml::Value {
    match json {
        serde_json::Value::Null => toml::Value::String("".to_string()),
        serde_json::Value::Bool(b) => toml::Value::Boolean(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                toml::Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                toml::Value::Float(f)
            } else {
                toml::Value::String(n.to_string())
            }
        }
        serde_json::Value::String(s) => toml::Value::String(s.clone()),
        serde_json::Value::Array(arr) => {
            let toml_arr = arr.iter().map(json_to_toml).collect();
            toml::Value::Array(toml_arr)
        }
        serde_json::Value::Object(obj) => {
            let mut toml_table = toml::map::Map::new();
            for (k, v) in obj {
                toml_table.insert(k.clone(), json_to_toml(v));
            }
            toml::Value::Table(toml_table)
        }
    }
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

    // 解析配置 JSON，包含 mcpServers 以及 managedNames
    let parsed: serde_json::Value = serde_json::from_str(&payload.config_json)
        .map_err(|error| format!("非法的 MCP JSON 配置：{error}"))?;

    let mcp_servers_json = parsed.get("mcpServers")
        .and_then(|v| v.as_object())
        .ok_or_else(|| "缺少 mcpServers 配置项。".to_string())?;

    let managed_names: Vec<String> = parsed.get("managedNames")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let action = if payload.enabled {
        ApplyAction::Updated
    } else {
        ApplyAction::Removed
    };

    match payload.editor_id {
        EditorId::Codex => {
            // TOML 处理逻辑 (config.toml) - 外科手术式局部标记块替换
            let mut enabled_servers = toml::map::Map::new();
            if payload.enabled {
                for name in &managed_names {
                    if let Some(json_val) = mcp_servers_json.get(name) {
                        enabled_servers.insert(name.clone(), json_to_toml(json_val));
                    }
                }
            }

            let fragment = if !enabled_servers.is_empty() {
                let mut dummy_root = toml::map::Map::new();
                dummy_root.insert("mcp_servers".to_string(), toml::Value::Table(enabled_servers));
                let mut serialized = toml::to_string_pretty(&toml::Value::Table(dummy_root))
                    .map_err(|error| format!("序列化 TOML 失败：{error}"))?;
                
                if serialized.starts_with("[mcp_servers]\n") {
                    serialized = serialized.replacen("[mcp_servers]\n", "", 1);
                } else if serialized.starts_with("mcp_servers = {}") {
                    serialized = "".to_string();
                }
                serialized.trim().to_string()
            } else {
                "".to_string()
            };

            let begin_marker = "# === BEGIN AI-COMPOSE MCP ===";
            let end_marker = "# === END AI-COMPOSE MCP ===";

            let mut toml_str = if target_path.exists() {
                fs::read_to_string(&target_path)
                    .map_err(|error| format!("读取 Codex 配置文件失败：{error}"))?
            } else {
                "".to_string()
            };

            if toml_str.contains(begin_marker) && toml_str.contains(end_marker) {
                // 分支 1：存在边界标记
                let start_idx = toml_str.find(begin_marker).unwrap();
                let end_idx = toml_str.find(end_marker).unwrap() + end_marker.len();
                
                if fragment.is_empty() {
                    // 如果要写入的配置为空，说明需要全部清除。我们直接把整个包含边界的块全部抹除！
                    let mut delete_range = start_idx..end_idx;
                    // 防御性处理：顺便删掉末尾多余的一个换行
                    if end_idx < toml_str.len() && toml_str.as_bytes()[end_idx] == b'\n' {
                        delete_range = start_idx..(end_idx + 1);
                    }
                    toml_str.replace_range(delete_range, "");
                } else {
                    // 有内容，正常更新受管块
                    let block_to_write = format!("{}\n{}\n{}", begin_marker, fragment, end_marker);
                    toml_str.replace_range(start_idx..end_idx, &block_to_write);
                }
            } else {
                // 分支 2：没有标记，只有在需要写入内容时才创建标记块
                if !fragment.is_empty() {
                    let block_to_write = format!("{}\n{}\n{}", begin_marker, fragment, end_marker);
                    
                    let mut toml_root = toml::from_str::<toml::Value>(&toml_str)
                        .unwrap_or_else(|_| toml::Value::Table(toml::map::Map::new()));
                    
                    if let Some(root_table) = toml_root.as_table_mut() {
                        if let Some(mcp_servers_val) = root_table.get_mut("mcp_servers") {
                            if let Some(mcp_servers_table) = mcp_servers_val.as_table_mut() {
                                for name in &managed_names {
                                    mcp_servers_table.remove(name);
                                }
                            }
                        }
                    }
                    
                    let mut clean_toml = toml::to_string_pretty(&toml_root)
                        .map_err(|error| format!("序列化 TOML 失败：{error}"))?;
                    
                    if !clean_toml.contains("[mcp_servers]") {
                        if clean_toml.contains("[mcp_servers.") {
                            clean_toml = clean_toml.replacen("[mcp_servers.", "[mcp_servers]\n\n[mcp_servers.", 1);
                        } else if clean_toml.contains("mcp_servers = {}") {
                            clean_toml = clean_toml.replace("mcp_servers = {}", "[mcp_servers]");
                        } else {
                            clean_toml.push_str("\n[mcp_servers]\n");
                        }
                    }

                    if let Some(idx) = clean_toml.find("[mcp_servers]") {
                        let insert_pos = idx + "[mcp_servers]".len();
                        clean_toml.insert_str(insert_pos, &format!("\n{}", block_to_write));
                    } else {
                        clean_toml.push_str(&format!("\n{}", block_to_write));
                    }
                    
                    toml_str = clean_toml;
                }
            }

            fs::write(&target_path, toml_str)
                .map_err(|error| format!("写入 Codex 配置文件失败：{error}"))?;
        }
        _ => {
            // JSON 处理逻辑 (mcp.json)
            let mut json_root = if target_path.exists() {
                let json_str = fs::read_to_string(&target_path)
                    .map_err(|error| format!("读取编辑器配置文件失败：{error}"))?;
                serde_json::from_str::<serde_json::Value>(&json_str)
                    .unwrap_or_else(|_| serde_json::json!({}))
            } else {
                serde_json::json!({})
            };

            // 确保有 mcpServers object
            if !json_root.is_object() {
                json_root = serde_json::json!({});
            }
            let root_obj = json_root.as_object_mut().unwrap();

            if !root_obj.contains_key("mcpServers") {
                root_obj.insert("mcpServers".to_string(), serde_json::json!({}));
            }
            let mcp_servers_obj = root_obj.get_mut("mcpServers")
                .and_then(|v| v.as_object_mut())
                .ok_or_else(|| "配置文件中的 mcpServers 不是一个 Object。".to_string())?;

            if payload.enabled {
                // 合并启用项：先从 mcpServers 中删除所有 managed_names，再从 mcp_servers_json 中取启用值插入
                for name in &managed_names {
                    mcp_servers_obj.remove(name);
                    if let Some(json_val) = mcp_servers_json.get(name) {
                        mcp_servers_obj.insert(name.clone(), json_val.clone());
                    }
                }
            } else {
                // 移除所有 managed_names
                for name in &managed_names {
                    mcp_servers_obj.remove(name);
                }
            }

            let next_content = serde_json::to_string_pretty(&json_root)
                .map_err(|error| format!("序列化 JSON 失败：{error}"))?;

            fs::write(&target_path, next_content)
                .map_err(|error| format!("写入编辑器配置文件失败：{error}"))?;
        }
    }

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
            Ok(home_path.join(".codex").join("config.toml"))
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
        return next_content;
    }

    let mut next_content =
        String::with_capacity(original_content.len() + managed_block.len() + 2);
    let normalized = normalize_trailing_newline(original_content);
    next_content.push_str(&normalized);
    if !normalized.is_empty() && !normalized.ends_with("\n\n") {
        next_content.push('\n');
    }
    next_content.push_str(managed_block);
    next_content.push('\n');
    next_content
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
        mcp_servers: None,
    })
}

fn build_editor_mcp_state(editor_id: EditorId) -> Result<EditorTargetState, String> {
    let target_path = resolve_editor_mcp_path(editor_id)?;
    let mut enabled = false;
    let mut mcp_servers = None;

    if target_path.exists() {
        let content = fs::read_to_string(&target_path)
            .map_err(|error| format!("读取编辑器目标 MCP 配置失败：{error}"))?;
        
        match editor_id {
            EditorId::Codex => {
                if let Ok(parsed) = toml::from_str::<toml::Value>(&content) {
                    if let Some(servers) = parsed.get("mcp_servers") {
                        if let Some(obj) = servers.as_table() {
                            enabled = !obj.is_empty();
                            mcp_servers = Some(toml_to_json(servers));
                        }
                    }
                }
            }
            _ => {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(servers) = parsed.get("mcpServers") {
                        if let Some(obj) = servers.as_object() {
                            enabled = !obj.is_empty();
                            mcp_servers = Some(servers.clone());
                        }
                    }
                }
            }
        }
    }

    Ok(EditorTargetState {
        enabled,
        target_path: target_path.display().to_string(),
        mcp_servers,
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
