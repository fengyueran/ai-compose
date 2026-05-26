use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tokio::process::Command as AsyncCommand;

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
    managed_mcp_servers: Option<serde_json::Value>,
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
async fn apply_prompt_to_editor_target(
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
async fn load_editor_target_states() -> Result<EditorTargetStates, String> {
    Ok(EditorTargetStates {
        antigravity: build_editor_target_state(EditorId::Antigravity)?,
        codex: build_editor_target_state(EditorId::Codex)?,
        cursor: build_editor_target_state(EditorId::Cursor)?,
    })
}

#[tauri::command]
async fn load_editor_mcp_states() -> Result<EditorTargetStates, String> {
    Ok(EditorTargetStates {
        antigravity: build_editor_mcp_state(EditorId::Antigravity)?,
        codex: build_editor_mcp_state(EditorId::Codex)?,
        cursor: build_editor_mcp_state(EditorId::Cursor)?,
    })
}

#[tauri::command]
async fn apply_mcp_to_editor_target(payload: ApplyMcpPayload) -> Result<ApplyMcpResult, String> {
    let target_path = resolve_editor_mcp_path(payload.editor_id)?;
    let parent_directory = target_path
        .parent()
        .ok_or_else(|| "无法确定编辑器目标目录。".to_string())?;

    fs::create_dir_all(parent_directory)
        .map_err(|error| format!("创建编辑器目标目录失败：{error}"))?;

    // 解析配置 JSON，包含 mcpServers 以及 managedNames
    let parsed: serde_json::Value = serde_json::from_str(&payload.config_json)
        .map_err(|error| format!("非法的 MCP JSON 配置：{error}"))?;

    let mcp_servers_json = parsed
        .get("mcpServers")
        .and_then(|v| v.as_object())
        .ok_or_else(|| "缺少 mcpServers 配置项。".to_string())?;

    let managed_names: Vec<String> = parsed
        .get("managedNames")
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
                dummy_root.insert(
                    "mcp_servers".to_string(),
                    toml::Value::Table(enabled_servers),
                );
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
                            clean_toml = clean_toml.replacen(
                                "[mcp_servers.",
                                "[mcp_servers]\n\n[mcp_servers.",
                                1,
                            );
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
            let mcp_servers_obj = root_obj
                .get_mut("mcpServers")
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
        EditorId::Antigravity => Ok(home_path
            .join(".gemini")
            .join("antigravity")
            .join("mcp_config.json")),
        EditorId::Codex => Ok(home_path.join(".codex").join("config.toml")),
        EditorId::Cursor => Ok(home_path.join(".cursor").join("mcp.json")),
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

    (
        ApplyAction::Unchanged,
        normalize_trailing_newline(original_content),
    )
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
        managed_mcp_servers: None,
    })
}

fn extract_managed_mcp_servers(content: &str) -> Option<serde_json::Value> {
    let begin_marker = "# === BEGIN AI-COMPOSE MCP ===";
    let end_marker = "# === END AI-COMPOSE MCP ===";

    let start_idx = content.find(begin_marker)?;
    let end_idx = content.find(end_marker)?;
    if start_idx >= end_idx {
        return None;
    }

    let managed_block = &content[start_idx + begin_marker.len()..end_idx];
    // 构造一个可被完整 TOML 解析器载入的伪文档
    let toml_doc = format!("[mcp_servers]\n{}", managed_block);
    if let Ok(parsed) = toml::from_str::<toml::Value>(&toml_doc) {
        if let Some(servers) = parsed.get("mcp_servers") {
            return Some(toml_to_json(servers));
        }
    }
    None
}

fn build_editor_mcp_state(editor_id: EditorId) -> Result<EditorTargetState, String> {
    let target_path = resolve_editor_mcp_path(editor_id)?;
    let mut enabled = false;
    let mut mcp_servers = None;
    let mut managed_mcp_servers = None;

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
                // 提取受管服务
                managed_mcp_servers = extract_managed_mcp_servers(&content);
            }
            _ => {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(servers) = parsed.get("mcpServers") {
                        if let Some(obj) = servers.as_object() {
                            enabled = !obj.is_empty();
                            mcp_servers = Some(servers.clone());
                            managed_mcp_servers = Some(servers.clone());
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
        managed_mcp_servers,
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillInfo {
    id: String,
    name: String,
    description: String,
    content: String,
    path: String,
    source_kind: SkillSourceKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    repo_source: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum SkillSourceKind {
    Cli,
    FallbackDirectory,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct EditorSkillsState {
    enabled: bool,
    target_path: String,
    enabled_skills: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EditorSkillsStates {
    antigravity: EditorSkillsState,
    codex: EditorSkillsState,
    cursor: EditorSkillsState,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApplySkillsPayload {
    editor_id: EditorId,
    enabled: bool,
    enabled_skills: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UnlinkSkillPayload {
    editor_id: EditorId,
    skill_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkSkillPayload {
    editor_id: EditorId,
    skill_id: String,
    skill_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoadSingleSkillPayload {
    id: String,
    path: String,
    source_kind: SkillSourceKind,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoadEditorInstalledSkillsPayload {
    editor_id: EditorId,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApplySkillsResult {
    action: ApplyAction,
    editor_id: EditorId,
    target_path: String,
    updated_at: String,
}

fn get_home_dir() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .map_err(|_| "无法读取当前用户的 HOME 目录。".to_string())
}

fn resolve_editor_skills_path(editor_id: EditorId) -> Result<PathBuf, String> {
    let home = get_home_dir()?;
    match editor_id {
        EditorId::Antigravity => Ok(home.join(".gemini").join("antigravity").join("skills")),
        EditorId::Codex => Ok(home.join(".codex").join("skills")),
        EditorId::Cursor => Ok(home.join(".cursor").join("skills")),
    }
}

fn is_editor_skills_target_path(path: &Path) -> bool {
    let Ok(home) = get_home_dir() else {
        return false;
    };
    let candidate = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let target_roots = [
        home.join(".codex").join("skills"),
        home.join(".cursor").join("skills"),
        home.join(".gemini").join("antigravity").join("skills"),
    ];

    target_roots.iter().any(|target_root| {
        let canonical_root = fs::canonicalize(target_root).unwrap_or_else(|_| target_root.clone());
        candidate.starts_with(canonical_root)
    })
}

fn resolve_skills_cli_lock_path() -> Result<PathBuf, String> {
    Ok(get_home_dir()?.join(".agents").join(".skill-lock.json"))
}

fn load_skills_cli_lock_json() -> Option<serde_json::Value> {
    let Ok(lock_path) = resolve_skills_cli_lock_path() else {
        return None;
    };
    let Ok(lock_content) = fs::read_to_string(lock_path) else {
        return None;
    };
    serde_json::from_str::<serde_json::Value>(&lock_content).ok()
}

fn load_skills_cli_lock_ids() -> std::collections::HashSet<String> {
    let Some(lock_json) = load_skills_cli_lock_json() else {
        return std::collections::HashSet::new();
    };

    lock_json
        .get("skills")
        .and_then(|skills| skills.as_object())
        .map(|skills| skills.keys().cloned().collect())
        .unwrap_or_default()
}

fn load_skills_cli_ids_by_repo(repo: &str) -> std::collections::HashSet<String> {
    let Some(lock_json) = load_skills_cli_lock_json() else {
        return std::collections::HashSet::new();
    };

    lock_json
        .get("skills")
        .and_then(|skills| skills.as_object())
        .map(|skills| {
            skills
                .iter()
                .filter_map(|(skill_id, entry)| {
                    let source = entry.get("source").and_then(|value| value.as_str())?;
                    if source == repo {
                        Some(skill_id.clone())
                    } else {
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

fn load_skills_cli_repo_sources() -> std::collections::HashMap<String, String> {
    let Some(lock_json) = load_skills_cli_lock_json() else {
        return std::collections::HashMap::new();
    };

    lock_json
        .get("skills")
        .and_then(|skills| skills.as_object())
        .map(|skills| {
            skills
                .iter()
                .filter_map(|(skill_id, entry)| {
                    let source = entry.get("source").and_then(|value| value.as_str())?;
                    Some((skill_id.clone(), source.to_string()))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn classify_cli_skill_source(
    path: &Path,
    skill_id: &str,
    managed_skill_ids: &std::collections::HashSet<String>,
) -> SkillSourceKind {
    if is_editor_skills_target_path(path) || !managed_skill_ids.contains(skill_id) {
        SkillSourceKind::FallbackDirectory
    } else {
        SkillSourceKind::Cli
    }
}

fn load_single_skill(
    path: &Path,
    id: &str,
    source_kind: SkillSourceKind,
    repo_source: Option<String>,
) -> Option<SkillInfo> {
    let skill_md_path = path.join("SKILL.md");
    if !skill_md_path.exists() {
        return None;
    }

    let content_str = fs::read_to_string(&skill_md_path).ok()?;
    let mut name = id.to_string();
    let mut description = String::new();
    let mut body = content_str.clone();

    if content_str.starts_with("---") {
        if let Some(second_dash_idx) = content_str[3..].find("---") {
            let front_matter = &content_str[3..(second_dash_idx + 3)];
            body = content_str[(second_dash_idx + 6)..].trim().to_string();

            for line in front_matter.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("name:") {
                    name = trimmed["name:".len()..]
                        .trim()
                        .trim_matches('"')
                        .trim_matches('\'')
                        .to_string();
                } else if trimmed.starts_with("description:") {
                    description = trimmed["description:".len()..]
                        .trim()
                        .trim_matches('"')
                        .trim_matches('\'')
                        .to_string();
                }
            }
        }
    }

    Some(SkillInfo {
        id: id.to_string(),
        name,
        description,
        content: body,
        path: path.display().to_string(),
        source_kind,
        repo_source,
    })
}

fn npx_command_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "npx.cmd"
    } else {
        "npx"
    }
}

fn is_safe_repo_source(repo: &str) -> bool {
    let mut parts = repo.split('/');
    let owner = parts.next().unwrap_or_default();
    let name = parts.next().unwrap_or_default();

    !owner.is_empty()
        && !name.is_empty()
        && parts.next().is_none()
        && owner.chars().all(is_safe_cli_identifier_char)
        && name.chars().all(is_safe_cli_identifier_char)
}

fn is_safe_external_url(url: &str) -> bool {
    let trimmed = url.trim();
    if trimmed.is_empty()
        || trimmed.contains('\n')
        || trimmed.contains('\r')
        || trimmed.contains('\0')
    {
        return false;
    }

    trimmed.starts_with("https://") || trimmed.starts_with("http://")
}

fn is_safe_local_path(path: &str) -> bool {
    let trimmed = path.trim();
    !trimmed.is_empty()
        && !trimmed.contains('\n')
        && !trimmed.contains('\r')
        && !trimmed.contains('\0')
}

fn normalize_repo_source(repo: &str) -> Option<String> {
    let trimmed = repo.trim().trim_end_matches('/');
    if is_safe_repo_source(trimmed) {
        return Some(trimmed.to_string());
    }

    let without_scheme = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(trimmed);
    let without_www = without_scheme
        .strip_prefix("www.")
        .unwrap_or(without_scheme);
    let github_path = without_www.strip_prefix("github.com/")?;
    let github_path = github_path.split(['?', '#']).next().unwrap_or(github_path);
    let path_without_suffix = github_path.trim_end_matches('/');
    let path_without_suffix = path_without_suffix
        .strip_suffix(".git")
        .unwrap_or(path_without_suffix)
        .trim_end_matches('/');

    let mut parts = path_without_suffix.split('/');
    let owner = parts.next().unwrap_or_default();
    let name = parts.next().unwrap_or_default();
    if owner.is_empty() || name.is_empty() || parts.next().is_some() {
        return None;
    }

    let normalized = format!("{owner}/{name}");
    is_safe_repo_source(&normalized).then_some(normalized)
}

fn is_safe_skill_id(skill_id: &str) -> bool {
    !skill_id.is_empty()
        && !skill_id.contains('/')
        && !skill_id.contains('\\')
        && skill_id.chars().all(is_safe_cli_identifier_char)
}

fn is_safe_cli_identifier_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.')
}

fn extract_skill_source_entries(value: &serde_json::Value) -> Vec<(String, PathBuf)> {
    let items: Vec<&serde_json::Value> = if let Some(arr) = value.as_array() {
        arr.iter().collect()
    } else if let Some(arr) = value.get("skills").and_then(|v| v.as_array()) {
        arr.iter().collect()
    } else if let Some(arr) = value.get("items").and_then(|v| v.as_array()) {
        arr.iter().collect()
    } else {
        Vec::new()
    };

    items
        .into_iter()
        .filter_map(|item| {
            let name = item
                .get("name")
                .or_else(|| item.get("id"))
                .and_then(|v| v.as_str())?;
            let path = item
                .get("path")
                .or_else(|| item.get("targetPath"))
                .or_else(|| item.get("target_path"))
                .and_then(|v| v.as_str())?;
            Some((name.to_string(), PathBuf::from(path)))
        })
        .collect()
}

fn collect_skills_from_directory(
    directory: &Path,
    managed_skill_ids: &std::collections::HashSet<String>,
    repo_sources: &std::collections::HashMap<String, String>,
) -> Vec<SkillInfo> {
    let mut skills = Vec::new();
    let mut loaded_ids = std::collections::HashSet::new();

    let Ok(entries) = fs::read_dir(directory) else {
        return skills;
    };

    for entry in entries.filter_map(Result::ok) {
        let entry_path = entry.path();
        let Ok(metadata) = fs::symlink_metadata(&entry_path) else {
            continue;
        };

        let Some(skill_id) = entry_path
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.to_string())
        else {
            continue;
        };

        let source_path = if metadata.file_type().is_symlink() {
            let Ok(target) = fs::read_link(&entry_path) else {
                continue;
            };
            let absolute_target = if target.is_absolute() {
                target
            } else {
                directory.join(target)
            };
            fs::canonicalize(&absolute_target).unwrap_or(absolute_target)
        } else if metadata.is_dir() {
            fs::canonicalize(&entry_path).unwrap_or(entry_path.clone())
        } else {
            continue;
        };

        let source_kind = classify_cli_skill_source(&source_path, &skill_id, managed_skill_ids);
        let repo_source = if source_kind == SkillSourceKind::Cli {
            repo_sources.get(&skill_id).cloned()
        } else {
            None
        };
        if let Some(skill) = load_single_skill(&source_path, &skill_id, source_kind, repo_source) {
            if loaded_ids.insert(skill.id.clone()) {
                skills.push(skill);
            }
        }
    }

    skills
}

fn resolve_global_skills_root() -> Result<PathBuf, String> {
    Ok(get_home_dir()?.join(".agents").join("skills"))
}

fn load_global_skills() -> Result<Vec<SkillInfo>, String> {
    let managed_skill_ids = load_skills_cli_lock_ids();
    let repo_sources = load_skills_cli_repo_sources();
    let global_root = resolve_global_skills_root()?;

    if !global_root.exists() || !global_root.is_dir() {
        return Ok(Vec::new());
    }

    Ok(collect_skills_from_directory(
        &global_root,
        &managed_skill_ids,
        &repo_sources,
    ))
}

fn load_editor_installed_skills_inner(editor_id: EditorId) -> Result<Vec<SkillInfo>, String> {
    let target_path = resolve_editor_skills_path(editor_id)?;
    if !target_path.exists() || !target_path.is_dir() {
        return Ok(Vec::new());
    }

    let managed_skill_ids = load_skills_cli_lock_ids();
    let repo_sources = load_skills_cli_repo_sources();
    Ok(collect_skills_from_directory(
        &target_path,
        &managed_skill_ids,
        &repo_sources,
    ))
}

async fn load_physical_skills_inner() -> Result<Vec<SkillInfo>, String> {
    load_global_skills()
}

#[tauri::command]
async fn load_physical_skills() -> Result<Vec<SkillInfo>, String> {
    load_physical_skills_inner().await
}

fn is_skill_enabled(editor_skills_dir: &Path, skill_id: &str, physical_skill_path: &Path) -> bool {
    let link_path = editor_skills_dir.join(skill_id);
    let metadata = match fs::symlink_metadata(&link_path) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };

    if !metadata.file_type().is_symlink() {
        return false;
    }

    if let Ok(target) = fs::read_link(&link_path) {
        let absolute_target = if target.is_absolute() {
            target
        } else {
            editor_skills_dir.join(target)
        };
        if let Ok(c_target) = fs::canonicalize(&absolute_target) {
            if let Ok(c_physical) = fs::canonicalize(physical_skill_path) {
                return c_target == c_physical;
            }
        }
    }
    false
}

fn build_editor_skills_state(editor_id: EditorId) -> Result<EditorSkillsState, String> {
    let target_path = resolve_editor_skills_path(editor_id)?;
    let enabled_skills = load_editor_installed_skills_inner(editor_id)?
        .into_iter()
        .map(|skill| skill.id)
        .collect::<Vec<_>>();

    let enabled = !enabled_skills.is_empty();

    Ok(EditorSkillsState {
        enabled,
        target_path: target_path.display().to_string(),
        enabled_skills,
    })
}

#[tauri::command]
async fn load_editor_skills_states() -> Result<EditorSkillsStates, String> {
    Ok(EditorSkillsStates {
        antigravity: build_editor_skills_state(EditorId::Antigravity)?,
        codex: build_editor_skills_state(EditorId::Codex)?,
        cursor: build_editor_skills_state(EditorId::Cursor)?,
    })
}

#[tauri::command]
async fn load_editor_installed_skills(
    payload: LoadEditorInstalledSkillsPayload,
) -> Result<Vec<SkillInfo>, String> {
    load_editor_installed_skills_inner(payload.editor_id)
}

#[cfg(unix)]
fn create_symlink<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> std::io::Result<()> {
    std::os::unix::fs::symlink(original, link)
}

#[cfg(windows)]
fn create_symlink<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> std::io::Result<()> {
    std::os::windows::fs::symlink_dir(original, link)
}

fn remove_link_or_dir(path: &Path) -> std::io::Result<()> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error),
    };

    if metadata.file_type().is_symlink() {
        fs::remove_file(path)?;
        return Ok(());
    }

    Err(std::io::Error::new(
        std::io::ErrorKind::AlreadyExists,
        "目标路径存在，但不是由 AI-COMPOSE 管理的技能软链接",
    ))
}

#[tauri::command]
async fn apply_skills_to_editor_target(
    payload: ApplySkillsPayload,
) -> Result<ApplySkillsResult, String> {
    let target_path = resolve_editor_skills_path(payload.editor_id)?;
    let physical_skills = load_physical_skills_inner().await?;

    let mut action = ApplyAction::Unchanged;

    if !payload.enabled {
        if target_path.exists() && target_path.is_dir() {
            for skill in &physical_skills {
                if skill.source_kind != SkillSourceKind::Cli {
                    continue;
                }
                if is_skill_enabled(&target_path, &skill.id, Path::new(&skill.path)) {
                    let link_path = target_path.join(&skill.id);
                    remove_link_or_dir(&link_path)
                        .map_err(|e| format!("清除技能软链接失败：{e}"))?;
                    action = ApplyAction::Removed;
                }
            }
        }
    } else {
        fs::create_dir_all(&target_path).map_err(|e| format!("创建编辑器 skills 目录失败：{e}"))?;

        for skill in &physical_skills {
            if skill.source_kind != SkillSourceKind::Cli {
                continue;
            }
            let should_enable = payload.enabled_skills.contains(&skill.id);
            let currently_enabled =
                is_skill_enabled(&target_path, &skill.id, Path::new(&skill.path));
            let link_path = target_path.join(&skill.id);

            if should_enable && !currently_enabled {
                if let Ok(metadata) = fs::symlink_metadata(&link_path) {
                    if !metadata.file_type().is_symlink() {
                        return Err(format!(
                            "目标路径 {} 已存在且不是技能软链接，为避免覆盖用户文件已停止写入。",
                            link_path.display()
                        ));
                    }
                    remove_link_or_dir(&link_path)
                        .map_err(|e| format!("移除已有技能软链接失败：{e}"))?;
                }
                create_symlink(Path::new(&skill.path), &link_path)
                    .map_err(|e| format!("创建技能软链接失败：{e}"))?;
                action = ApplyAction::Updated;
            } else if !should_enable && currently_enabled {
                remove_link_or_dir(&link_path).map_err(|e| format!("删除技能软链接失败：{e}"))?;
                action = ApplyAction::Removed;
            }
        }
    }

    Ok(ApplySkillsResult {
        action,
        editor_id: payload.editor_id,
        target_path: target_path.display().to_string(),
        updated_at: current_timestamp(),
    })
}

#[tauri::command]
async fn unlink_skill_from_editor(
    payload: UnlinkSkillPayload,
) -> Result<ApplySkillsResult, String> {
    let skill_id_trimmed = payload.skill_id.trim().to_string();
    if !is_safe_skill_id(&skill_id_trimmed) {
        return Err("技能 ID 只能包含字母、数字、点、下划线和短横线。".to_string());
    }

    let target_path = resolve_editor_skills_path(payload.editor_id)?;
    let link_path = target_path.join(&skill_id_trimmed);
    let action = match fs::symlink_metadata(&link_path) {
        Ok(metadata) => {
            if !metadata.file_type().is_symlink() {
                return Err(format!(
                    "目标路径 {} 已存在且不是技能软链接，为避免误删已停止操作。",
                    link_path.display()
                ));
            }
            remove_link_or_dir(&link_path).map_err(|e| format!("删除技能软链接失败：{e}"))?;
            ApplyAction::Removed
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => ApplyAction::Unchanged,
        Err(error) => return Err(format!("读取技能软链接状态失败：{error}")),
    };

    Ok(ApplySkillsResult {
        action,
        editor_id: payload.editor_id,
        target_path: target_path.display().to_string(),
        updated_at: current_timestamp(),
    })
}

#[tauri::command]
async fn link_skill_to_editor(payload: LinkSkillPayload) -> Result<ApplySkillsResult, String> {
    let skill_id_trimmed = payload.skill_id.trim().to_string();
    if !is_safe_skill_id(&skill_id_trimmed) {
        return Err("技能 ID 只能包含字母、数字、点、下划线和短横线。".to_string());
    }

    let skill_path_trimmed = payload.skill_path.trim().to_string();
    if skill_path_trimmed.is_empty() {
        return Err("技能物理路径不能为空。".to_string());
    }

    let physical_skill_path = PathBuf::from(&skill_path_trimmed);
    let target_path = resolve_editor_skills_path(payload.editor_id)?;
    fs::create_dir_all(&target_path).map_err(|e| format!("创建编辑器 skills 目录失败：{e}"))?;

    let link_path = target_path.join(&skill_id_trimmed);
    if is_skill_enabled(&target_path, &skill_id_trimmed, &physical_skill_path) {
        return Ok(ApplySkillsResult {
            action: ApplyAction::Unchanged,
            editor_id: payload.editor_id,
            target_path: target_path.display().to_string(),
            updated_at: current_timestamp(),
        });
    }

    if let Ok(metadata) = fs::symlink_metadata(&link_path) {
        if !metadata.file_type().is_symlink() {
            return Err(format!(
                "目标路径 {} 已存在且不是技能软链接，为避免覆盖用户文件已停止写入。",
                link_path.display()
            ));
        }
        remove_link_or_dir(&link_path).map_err(|e| format!("移除已有技能软链接失败：{e}"))?;
    }

    create_symlink(&physical_skill_path, &link_path)
        .map_err(|e| format!("创建技能软链接失败：{e}"))?;

    Ok(ApplySkillsResult {
        action: ApplyAction::Updated,
        editor_id: payload.editor_id,
        target_path: target_path.display().to_string(),
        updated_at: current_timestamp(),
    })
}

#[tauri::command]
async fn load_single_skill_command(payload: LoadSingleSkillPayload) -> Result<SkillInfo, String> {
    let repo_source = if payload.source_kind == SkillSourceKind::Cli {
        load_skills_cli_repo_sources().get(&payload.id).cloned()
    } else {
        None
    };
    load_single_skill(
        Path::new(&payload.path),
        &payload.id,
        payload.source_kind,
        repo_source,
    )
    .ok_or_else(|| format!("无法读取技能 {} 的最新内容。", payload.id))
}

#[tauri::command]
async fn load_skills_from_dir(path: String) -> Result<Vec<SkillInfo>, String> {
    let dir_path = PathBuf::from(&path);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("目录不存在或不是文件夹：{}", path));
    }
    let managed_skill_ids = load_skills_cli_lock_ids();
    let repo_sources = load_skills_cli_repo_sources();
    Ok(collect_skills_from_directory(
        &dir_path,
        &managed_skill_ids,
        &repo_sources,
    ))
}


#[tauri::command]
async fn add_skills_repository(repo: String) -> Result<Vec<SkillInfo>, String> {
    let Some(repo_trimmed) = normalize_repo_source(&repo) else {
        return Err(
            "仓库源必须使用 owner/repo 格式，或提供对应的 GitHub 仓库链接；且只能包含字母、数字、点、下划线和短横线。"
                .to_string(),
        );
    };

    let output = AsyncCommand::new(npx_command_name())
        .args(["skills", "add", &repo_trimmed, "-g", "-y"])
        .output()
        .await;

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                let repo_skill_ids = load_skills_cli_ids_by_repo(&repo_trimmed);
                let repo_skills = load_global_skills()?
                    .into_iter()
                    .filter(|skill| repo_skill_ids.contains(&skill.id))
                    .collect();
                Ok(repo_skills)
            } else {
                Err(format!(
                    "安装技能失败，错误码：{:?}\n输出：{}\n错误：{}",
                    out.status.code(),
                    stdout,
                    stderr
                ))
            }
        }
        Err(e) => Err(format!("无法运行安装命令：{e}")),
    }
}

#[tauri::command]
async fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim().to_string();
    if !is_safe_external_url(&trimmed) {
        return Err("仅支持打开安全的 http/https 外部链接。".to_string());
    }

    let mut command = if cfg!(target_os = "macos") {
        let mut cmd = std::process::Command::new("open");
        cmd.arg(&trimmed);
        cmd
    } else if cfg!(target_os = "windows") {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "start", "", &trimmed]);
        cmd
    } else {
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(&trimmed);
        cmd
    };

    command
        .spawn()
        .map_err(|e| format!("打开外部链接失败：{e}"))?;
    Ok(())
}

#[tauri::command]
async fn open_local_path(path: String) -> Result<(), String> {
    let trimmed = path.trim().to_string();
    if !is_safe_local_path(&trimmed) {
        return Err("仅支持打开安全的本地路径。".to_string());
    }

    let path_buf = PathBuf::from(&trimmed);
    if !path_buf.exists() {
        return Err("目标本地路径不存在，无法打开。".to_string());
    }

    let mut command = if cfg!(target_os = "macos") {
        let mut cmd = std::process::Command::new("open");
        cmd.arg(&trimmed);
        cmd
    } else if cfg!(target_os = "windows") {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "start", "", &trimmed]);
        cmd
    } else {
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(&trimmed);
        cmd
    };

    command
        .spawn()
        .map_err(|e| format!("打开本地路径失败：{e}"))?;
    Ok(())
}

#[tauri::command]
async fn reveal_local_path(path: String) -> Result<(), String> {
    let trimmed = path.trim().to_string();
    if !is_safe_local_path(&trimmed) {
        return Err("仅支持定位安全的本地路径。".to_string());
    }

    let path_buf = PathBuf::from(&trimmed);
    if !path_buf.exists() {
        return Err("目标本地路径不存在，无法定位。".to_string());
    }

    let mut command = if cfg!(target_os = "macos") {
        let mut cmd = std::process::Command::new("open");
        cmd.args(["-R", &trimmed]);
        cmd
    } else if cfg!(target_os = "windows") {
        let mut cmd = std::process::Command::new("explorer");
        cmd.arg(format!("/select,{}", trimmed));
        cmd
    } else {
        let parent = path_buf.parent().unwrap_or(&path_buf);
        let mut cmd = std::process::Command::new("xdg-open");
        cmd.arg(parent);
        cmd
    };

    command
        .spawn()
        .map_err(|e| format!("定位本地路径失败：{e}"))?;
    Ok(())
}

#[tauri::command]
async fn update_skill(skill_id: String) -> Result<String, String> {
    let skill_id_trimmed = skill_id.trim().to_string();
    let output = if skill_id_trimmed.is_empty() {
        AsyncCommand::new(npx_command_name())
            .args(["skills", "update", "-g", "-y"])
            .output()
            .await
    } else {
        if !is_safe_skill_id(&skill_id_trimmed) {
            return Err("技能 ID 只能包含字母、数字、点、下划线和短横线。".to_string());
        }
        AsyncCommand::new(npx_command_name())
            .args(["skills", "update", &skill_id_trimmed, "-g", "-y"])
            .output()
            .await
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                Ok(stdout)
            } else {
                Err(format!(
                    "更新技能失败，错误码：{:?}\n输出：{}\n错误：{}",
                    out.status.code(),
                    stdout,
                    stderr
                ))
            }
        }
        Err(e) => Err(format!("无法运行更新命令：{e}")),
    }
}

#[tauri::command]
async fn remove_skill(skill_id: String) -> Result<String, String> {
    let skill_id_trimmed = skill_id.trim().to_string();
    if !is_safe_skill_id(&skill_id_trimmed) {
        return Err("技能 ID 只能包含字母、数字、点、下划线和短横线。".to_string());
    }

    let output = AsyncCommand::new(npx_command_name())
        .args(["skills", "remove", &skill_id_trimmed, "-g", "-y"])
        .output()
        .await;

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                Ok(stdout)
            } else {
                Err(format!(
                    "移除技能来源失败，错误码：{:?}\n输出：{}\n错误：{}",
                    out.status.code(),
                    stdout,
                    stderr
                ))
            }
        }
        Err(e) => Err(format!("无法运行移除命令：{e}")),
    }
}

#[tauri::command]
fn select_directory() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("osascript")
            .arg("-e")
            .arg("POSIX path of (choose folder with prompt \"请选择技能物理目录:\")")
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if path_str.is_empty() {
                Err("canceled".to_string())
            } else {
                Ok(path_str)
            }
        } else {
            let err_str = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if err_str.contains("User canceled") || err_str.contains("-128") {
                Err("canceled".to_string())
            } else {
                Err(err_str)
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("当前系统不支持原生文件夹选择器，请手动输入路径。".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            apply_prompt_to_editor_target,
            load_editor_target_states,
            load_editor_mcp_states,
            apply_mcp_to_editor_target,
            load_physical_skills,
            load_editor_skills_states,
            load_editor_installed_skills,
            load_skills_from_dir,
            apply_skills_to_editor_target,
            unlink_skill_from_editor,
            link_skill_to_editor,
            load_single_skill_command,
            add_skills_repository,
            open_external_url,
            open_local_path,
            reveal_local_path,
            update_skill,
            remove_skill,
            select_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_dir(name: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("ai-compose-{name}-{timestamp}"))
    }

    #[test]
    fn test_resolve_cursor_mcp_path() {
        let path = resolve_editor_mcp_path(EditorId::Cursor).unwrap();
        assert!(path.to_string_lossy().contains(".cursor"));
        assert!(path.to_string_lossy().ends_with("mcp.json"));
    }

    #[test]
    fn test_resolve_antigravity_mcp_path() {
        let path = resolve_editor_mcp_path(EditorId::Antigravity).unwrap();
        assert!(path.to_string_lossy().contains(".gemini"));
        assert!(path.to_string_lossy().contains("antigravity"));
        assert!(path.to_string_lossy().ends_with("mcp_config.json"));
    }

    #[test]
    fn test_build_cursor_mcp_state() {
        let state = build_editor_mcp_state(EditorId::Cursor).unwrap();
        assert!(state.target_path.contains(".cursor"));
        if std::path::Path::new(&state.target_path).exists() {
            assert!(state.mcp_servers.is_some());
            let mcp_servers_val = state.mcp_servers.unwrap();
            assert!(mcp_servers_val.is_object());
            let mcp_servers_obj = mcp_servers_val.as_object().unwrap();
            assert!(mcp_servers_obj.contains_key("figma"));
        }
    }

    #[test]
    fn test_build_antigravity_mcp_state() {
        let state = build_editor_mcp_state(EditorId::Antigravity).unwrap();
        assert!(state.target_path.contains(".gemini"));
        assert!(state.target_path.contains("antigravity"));
        assert!(state.target_path.contains("mcp_config.json"));
        if std::path::Path::new(&state.target_path).exists() {
            // 确保如果存在 mcp_config.json，能正确解析出 mcpServers 的结构
            if state.mcp_servers.is_some() {
                let mcp_servers_val = state.mcp_servers.unwrap();
                assert!(mcp_servers_val.is_object());
            }
        }
    }

    #[test]
    fn test_resolve_antigravity_skills_path() {
        let path = resolve_editor_skills_path(EditorId::Antigravity).unwrap();
        assert!(path.to_string_lossy().contains(".gemini"));
        assert!(path.to_string_lossy().contains("antigravity"));
        assert!(path.to_string_lossy().ends_with("skills"));
    }

    #[test]
    fn test_build_antigravity_skills_state() {
        let state = build_editor_skills_state(EditorId::Antigravity).unwrap();
        assert!(state.target_path.contains(".gemini"));
        assert!(state.target_path.contains("antigravity"));
        assert!(state.target_path.ends_with("skills"));
    }

    #[test]
    fn test_load_single_skill_extracts_front_matter_and_body() {
        let root = unique_test_dir("skill-frontmatter");
        let skill_dir = root.join("react-development");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: \"React Development\"\ndescription: \"React task router\"\n---\n\n# Usage\n\nUse it.",
        )
        .unwrap();

        let skill = load_single_skill(
            &skill_dir,
            "react-development",
            SkillSourceKind::Cli,
            Some("fengyueran/skills".to_string()),
        )
        .unwrap();
        assert_eq!(skill.id, "react-development");
        assert_eq!(skill.name, "React Development");
        assert_eq!(skill.description, "React task router");
        assert_eq!(skill.content, "# Usage\n\nUse it.");
        assert_eq!(skill.source_kind, SkillSourceKind::Cli);
        assert_eq!(skill.repo_source.as_deref(), Some("fengyueran/skills"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn test_extract_skill_source_entries_supports_array_and_wrapped_shapes() {
        let array_json = serde_json::json!([
            { "name": "alpha", "path": "/tmp/alpha" },
            { "id": "beta", "targetPath": "/tmp/beta" }
        ]);
        let entries = extract_skill_source_entries(&array_json);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].0, "alpha");
        assert_eq!(entries[1].0, "beta");

        let wrapped_json = serde_json::json!({
            "skills": [{ "name": "gamma", "target_path": "/tmp/gamma" }]
        });
        let wrapped_entries = extract_skill_source_entries(&wrapped_json);
        assert_eq!(wrapped_entries.len(), 1);
        assert_eq!(wrapped_entries[0].0, "gamma");
    }

    #[test]
    fn test_collect_skills_from_directory_reads_symlink_targets_and_local_dirs() {
        let root = unique_test_dir("collect-skills-from-directory");
        let source_dir = root.join("source").join("find-skills");
        let local_dir = root.join("editor").join("local-skill");
        let linked_dir = root.join("editor").join("find-skills");
        fs::create_dir_all(&source_dir).unwrap();
        fs::create_dir_all(&local_dir).unwrap();
        fs::write(source_dir.join("SKILL.md"), "# find-skills").unwrap();
        fs::write(local_dir.join("SKILL.md"), "# local-skill").unwrap();
        create_symlink(&source_dir, &linked_dir).unwrap();

        let mut managed_ids = std::collections::HashSet::new();
        managed_ids.insert("find-skills".to_string());

        let repo_sources = std::collections::HashMap::from([(
            "find-skills".to_string(),
            "vercel-labs/skills".to_string(),
        )]);
        let skills =
            collect_skills_from_directory(&root.join("editor"), &managed_ids, &repo_sources);
        assert_eq!(skills.len(), 2);
        assert!(skills.iter().any(|skill| skill.id == "find-skills"
            && skill.source_kind == SkillSourceKind::Cli
            && skill.repo_source.as_deref() == Some("vercel-labs/skills")));
        assert!(skills.iter().any(|skill| skill.id == "local-skill"
            && skill.source_kind == SkillSourceKind::FallbackDirectory
            && skill.repo_source.is_none()));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn test_skill_enablement_requires_matching_symlink() {
        let root = unique_test_dir("skill-link");
        let physical_dir = root.join("source").join("react-development");
        let editor_dir = root.join("editor-skills");
        fs::create_dir_all(&physical_dir).unwrap();
        fs::create_dir_all(&editor_dir).unwrap();

        let unmanaged_dir = editor_dir.join("react-development");
        fs::create_dir_all(&unmanaged_dir).unwrap();
        assert!(!is_skill_enabled(
            &editor_dir,
            "react-development",
            &physical_dir
        ));
        fs::remove_dir_all(&unmanaged_dir).unwrap();

        create_symlink(&physical_dir, editor_dir.join("react-development")).unwrap();
        assert!(is_skill_enabled(
            &editor_dir,
            "react-development",
            &physical_dir
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn test_cli_input_validation_rejects_shell_like_values() {
        assert!(is_safe_repo_source("vercel-labs/agent-skills"));
        assert!(!is_safe_repo_source("vercel-labs/agent-skills;rm"));
        assert!(is_safe_external_url("https://github.com/fengyueran/skills"));
        assert!(is_safe_external_url("http://127.0.0.1:3000"));
        assert!(!is_safe_external_url("javascript:alert(1)"));
        assert!(!is_safe_external_url("file:///tmp/test"));
        assert!(is_safe_local_path("/Users/xinghunm/.agents/skills/brainstorming"));
        assert!(!is_safe_local_path(""));
        assert!(!is_safe_local_path("/tmp/test\nnext"));
        assert_eq!(
            normalize_repo_source("https://github.com/vercel-labs/agent-skills"),
            Some("vercel-labs/agent-skills".to_string())
        );
        assert_eq!(
            normalize_repo_source("github.com/vercel-labs/agent-skills/"),
            Some("vercel-labs/agent-skills".to_string())
        );
        assert_eq!(
            normalize_repo_source("https://github.com/vercel-labs/agent-skills.git"),
            Some("vercel-labs/agent-skills".to_string())
        );
        assert_eq!(
            normalize_repo_source("https://github.com/vercel-labs/agent-skills?tab=readme-ov-file"),
            Some("vercel-labs/agent-skills".to_string())
        );
        assert_eq!(
            normalize_repo_source("https://github.com/vercel-labs/agent-skills/tree/main"),
            None
        );
        assert_eq!(
            normalize_repo_source("https://example.com/vercel-labs/agent-skills"),
            None
        );
        assert_eq!(normalize_repo_source("vercel-labs/agent-skills;rm"), None);

        assert!(is_safe_skill_id("react-development"));
        assert!(!is_safe_skill_id("../react-development"));
        assert!(!is_safe_skill_id("react;development"));
    }

    #[test]
    fn test_fallback_skills_are_not_marked_enabled() {
        let root = unique_test_dir("fallback-skill-state");
        let physical_dir = root.join("fallback").join("local-skill");
        let editor_dir = root.join("editor-skills");
        fs::create_dir_all(&physical_dir).unwrap();
        fs::create_dir_all(&editor_dir).unwrap();
        fs::write(physical_dir.join("SKILL.md"), "# Local Skill").unwrap();
        create_symlink(&physical_dir, editor_dir.join("local-skill")).unwrap();

        let skill = load_single_skill(
            &physical_dir,
            "local-skill",
            SkillSourceKind::FallbackDirectory,
            None,
        )
        .unwrap();
        let mut enabled_skills = Vec::new();

        if skill.source_kind == SkillSourceKind::Cli
            && is_skill_enabled(&editor_dir, &skill.id, Path::new(&skill.path))
        {
            enabled_skills.push(skill.id.clone());
        }

        assert!(enabled_skills.is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn test_editor_target_paths_are_not_cli_managed_sources() {
        let home = get_home_dir().unwrap();
        let mut managed_skill_ids = std::collections::HashSet::new();
        managed_skill_ids.insert("local-skill".to_string());

        let editor_target_skill = home.join(".codex").join("skills").join("local-skill");
        assert_eq!(
            classify_cli_skill_source(&editor_target_skill, "local-skill", &managed_skill_ids),
            SkillSourceKind::FallbackDirectory
        );

        let external_skill = home
            .join("my-house")
            .join("skills")
            .join("skills")
            .join("local-skill");
        assert_eq!(
            classify_cli_skill_source(&external_skill, "local-skill", &managed_skill_ids),
            SkillSourceKind::Cli
        );
    }

    #[test]
    fn test_cli_listed_external_paths_require_lock_membership() {
        let home = get_home_dir().unwrap();
        let external_skill = home
            .join("my-house")
            .join("skills")
            .join("skills")
            .join("react-development");
        let managed_skill_ids = std::collections::HashSet::new();

        assert_eq!(
            classify_cli_skill_source(&external_skill, "react-development", &managed_skill_ids),
            SkillSourceKind::FallbackDirectory
        );
    }

    #[test]
    fn test_load_skills_from_dir() {
        let root = unique_test_dir("load-skills-from-dir");
        let skill_dir = root.join("test-skill-one");
        let other_dir = root.join("not-a-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::create_dir_all(&other_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "# Test Skill One\nThis is content.").unwrap();
        fs::write(other_dir.join("README.md"), "Not a skill").unwrap();

        let skills = tauri::async_runtime::block_on(load_skills_from_dir(root.display().to_string())).unwrap();
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].id, "test-skill-one");
        assert_eq!(skills[0].name, "test-skill-one");

        fs::remove_dir_all(root).unwrap();
    }
}
