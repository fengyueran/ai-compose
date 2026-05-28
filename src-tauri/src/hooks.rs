use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{PathBuf};
use crate::editor::{EditorId, resolve_editor_hooks_path};
use crate::utils::{ApplyAction, current_timestamp, get_home_dir};

#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum HookTrigger {
    BeforeRun,
    AfterRun,
    AfterFailure,
    BeforeCommit,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HookCommand {
    pub id: String,
    pub command: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HookDefinition {
    pub id: String,
    pub name: String,
    pub trigger: HookTrigger,
    pub commands: Vec<HookCommand>,
    pub enabled_editors: std::collections::HashMap<EditorId, bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyHooksPayload {
    pub hooks: Vec<HookDefinition>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyHooksResult {
    pub action: ApplyAction,
    pub editor_id: EditorId,
    pub target_path: String,
    pub updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HooksConfigState {
    pub hooks: Vec<HookDefinition>,
    pub target_paths: std::collections::HashMap<EditorId, String>,
    pub validation_errors: Vec<String>,
}



// Structures for saving to Codex hooks config files (standard Codex hooks.json format)
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CodexHandler {
    pub r#type: String,
    pub command: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct CodexMatcherGroup {
    pub matcher: String,
    pub hooks: Vec<CodexHandler>,
}

#[derive(Serialize, Clone, Debug)]
pub struct CodexHooksState {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "PreToolUse")]
    pub pre_tool_use: Option<Vec<CodexMatcherGroup>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "PostToolUse")]
    pub post_tool_use: Option<Vec<CodexMatcherGroup>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "Stop")]
    pub stop: Option<Vec<CodexMatcherGroup>>,
}

#[derive(Serialize, Clone, Debug)]
pub struct CodexHooksFile {
    pub hooks: CodexHooksState,
}

pub fn resolve_hooks_workbench_path() -> Result<PathBuf, String> {
    Ok(get_home_dir()?.join(".agents").join("hooks_workbench.json"))
}

#[tauri::command]
pub async fn load_editor_hooks_states() -> Result<HooksConfigState, String> {
    let workbench_path = resolve_hooks_workbench_path()?;
    
    let mut hooks = Vec::new();
    if workbench_path.exists() {
        if let Ok(content) = fs::read_to_string(&workbench_path) {
            if let Ok(parsed) = serde_json::from_str::<Vec<HookDefinition>>(&content) {
                hooks = parsed;
            }
        }
    }

    let mut target_paths = std::collections::HashMap::new();
    for editor_id in &[EditorId::Antigravity, EditorId::Codex, EditorId::Cursor] {
        let path = resolve_editor_hooks_path(*editor_id)?;
        target_paths.insert(*editor_id, path.display().to_string());
    }

    Ok(HooksConfigState {
        hooks,
        target_paths,
        validation_errors: Vec::new(),
    })
}

#[tauri::command]
pub async fn apply_hooks_to_editor_target(payload: ApplyHooksPayload) -> Result<ApplyHooksResult, String> {
    let workbench_path = resolve_hooks_workbench_path()?;
    
    // 1. Save global shared workbench hooks configuration
    if let Some(parent) = workbench_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建全局配置目录失败：{error}"))?;
    }
    let serialized = serde_json::to_string_pretty(&payload.hooks)
        .map_err(|error| format!("序列化 Hooks 数据失败：{error}"))?;
    fs::write(&workbench_path, serialized)
        .map_err(|error| format!("保存 Hooks 共享数据失败：{error}"))?;

    // 2. Synchronize configuration files to target directories for enabled editors
    for editor_id in &[EditorId::Antigravity, EditorId::Codex, EditorId::Cursor] {
        let target_path = resolve_editor_hooks_path(*editor_id)?;
        
        let enabled_hooks: Vec<&HookDefinition> = payload.hooks
            .iter()
            .filter(|h| *h.enabled_editors.get(editor_id).unwrap_or(&false))
            .collect();

        if enabled_hooks.is_empty() {
            if target_path.exists() {
                let _ = fs::remove_file(&target_path);
            }
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).map_err(|error| format!("创建编辑器配置目录失败：{error}"))?;
            }

            match editor_id {
                EditorId::Codex => {
                    let mut pre_tool_use = Vec::new();
                    let mut post_tool_use = Vec::new();
                    let mut stop = Vec::new();

                    for hook in enabled_hooks {
                        let commands: Vec<String> = hook.commands
                            .iter()
                            .map(|c| c.command.clone())
                            .filter(|c| !c.is_empty())
                            .collect();

                        if commands.is_empty() {
                            continue;
                        }

                        let handlers: Vec<CodexHandler> = commands
                            .into_iter()
                            .map(|cmd| CodexHandler {
                                r#type: "command".to_string(),
                                command: cmd,
                            })
                            .collect();

                        match hook.trigger {
                            HookTrigger::BeforeRun => {
                                pre_tool_use.push(CodexMatcherGroup {
                                    matcher: "apply_patch|Edit|Write".to_string(),
                                    hooks: handlers,
                                });
                            }
                            HookTrigger::AfterRun | HookTrigger::AfterFailure => {
                                post_tool_use.push(CodexMatcherGroup {
                                    matcher: "apply_patch|Edit|Write".to_string(),
                                    hooks: handlers,
                                });
                            }
                            HookTrigger::BeforeCommit => {
                                stop.push(CodexMatcherGroup {
                                    matcher: "*".to_string(),
                                    hooks: handlers,
                                });
                            }
                        }
                    }

                    let codex_hooks = CodexHooksState {
                        pre_tool_use: if pre_tool_use.is_empty() { None } else { Some(pre_tool_use) },
                        post_tool_use: if post_tool_use.is_empty() { None } else { Some(post_tool_use) },
                        stop: if stop.is_empty() { None } else { Some(stop) },
                    };

                    let file_content = CodexHooksFile { hooks: codex_hooks };
                    let serialized_file = serde_json::to_string_pretty(&file_content)
                        .map_err(|error| format!("序列化 Codex Hooks JSON 失败：{error}"))?;
                    
                    fs::write(&target_path, serialized_file)
                        .map_err(|error| format!("写入 Codex Hooks 配置文件失败：{error}"))?;
                }
                _ => {
                    let mut file_obj = serde_json::Map::new();

                    for hook in enabled_hooks {
                        let commands: Vec<String> = hook.commands
                            .iter()
                            .map(|c| c.command.clone())
                            .filter(|c| !c.is_empty())
                            .collect();

                        if commands.is_empty() {
                            continue;
                        }

                        let event_name = match hook.trigger {
                            HookTrigger::BeforeRun => "PreToolUse",
                            HookTrigger::AfterRun | HookTrigger::AfterFailure => "PostToolUse",
                            HookTrigger::BeforeCommit => "Stop",
                        };

                        let handlers: Vec<serde_json::Value> = commands
                            .into_iter()
                            .map(|cmd| serde_json::json!({
                                "type": "command",
                                "command": cmd,
                                "timeout": 30
                            }))
                            .collect();

                        let event_value = if event_name == "PreToolUse" || event_name == "PostToolUse" {
                            serde_json::json!([
                                {
                                    "matcher": "write_to_file|replace_file_content|multi_replace_file_content",
                                    "hooks": handlers
                                }
                            ])
                        } else {
                            serde_json::json!(handlers)
                        };

                        let mut hook_entry = serde_json::Map::new();
                        hook_entry.insert("enabled".to_string(), serde_json::Value::Bool(true));
                        hook_entry.insert(event_name.to_string(), event_value);

                        file_obj.insert(hook.name.clone(), serde_json::Value::Object(hook_entry));
                    }

                    let serialized_file = serde_json::to_string_pretty(&serde_json::Value::Object(file_obj))
                        .map_err(|error| format!("序列化编辑器 Hooks JSON 失败：{error}"))?;

                    fs::write(&target_path, serialized_file)
                        .map_err(|error| format!("写入编辑器 Hooks 配置文件失败：{error}"))?;
                }
            }
        }
    }

    Ok(ApplyHooksResult {
        action: ApplyAction::Updated,
        editor_id: EditorId::Codex,
        target_path: resolve_editor_hooks_path(EditorId::Codex)?.display().to_string(),
        updated_at: current_timestamp(),
    })
}
