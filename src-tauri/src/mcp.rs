use serde::{Deserialize, Serialize};
use std::fs;
use crate::editor::{EditorId, resolve_editor_mcp_path};
use crate::prompt::EditorTargetState;
use crate::utils::{ApplyAction, current_timestamp, json_to_toml, toml_to_json};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyMcpPayload {
    pub editor_id: EditorId,
    pub enabled: bool,
    pub config_json: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyMcpResult {
    pub action: ApplyAction,
    pub editor_id: EditorId,
    pub target_path: String,
    pub updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorTargetStates {
    pub antigravity: EditorTargetState,
    pub codex: EditorTargetState,
    pub cursor: EditorTargetState,
}

#[tauri::command]
pub async fn load_editor_mcp_states() -> Result<EditorTargetStates, String> {
    Ok(EditorTargetStates {
        antigravity: build_editor_mcp_state(EditorId::Antigravity)?,
        codex: build_editor_mcp_state(EditorId::Codex)?,
        cursor: build_editor_mcp_state(EditorId::Cursor)?,
    })
}

#[tauri::command]
pub async fn apply_mcp_to_editor_target(payload: ApplyMcpPayload) -> Result<ApplyMcpResult, String> {
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

pub fn extract_managed_mcp_servers(content: &str) -> Option<serde_json::Value> {
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

pub fn build_editor_mcp_state(editor_id: EditorId) -> Result<EditorTargetState, String> {
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
