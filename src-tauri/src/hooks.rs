use crate::editor::{resolve_editor_hooks_path, EditorId};
use crate::utils::{current_timestamp, get_home_dir, ApplyAction};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum HookTrigger {
    BeforeRun,
    AfterRun,
    AfterFailure,
    BeforeCommit,
}

#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum HookMode {
    Raw,
    FormatTemplate,
}

impl Default for HookMode {
    fn default() -> Self {
        Self::Raw
    }
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
    #[serde(default)]
    pub mode: HookMode,
    #[serde(default)]
    pub format_command: Option<String>,
    #[serde(default)]
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

const ANTIGRAVITY_TOOL_MATCHER: &str = "*";
const CURSOR_WRITE_TOOL_MATCHER: &str = "Write";
const CODEX_TOOL_MATCHER: &str = "apply_patch|Edit|Write|Bash";
const FORMAT_CURRENT_FILE_PLACEHOLDER: &str = "{{current_file}}";

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
pub async fn apply_hooks_to_editor_target(
    payload: ApplyHooksPayload,
) -> Result<ApplyHooksResult, String> {
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

        let enabled_hooks: Vec<&HookDefinition> = payload
            .hooks
            .iter()
            .filter(|h| *h.enabled_editors.get(editor_id).unwrap_or(&false))
            .collect();

        if enabled_hooks.is_empty() {
            if target_path.exists() {
                let _ = fs::remove_file(&target_path);
            }
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("创建编辑器配置目录失败：{error}"))?;
            }

            match editor_id {
                EditorId::Codex => {
                    let mut pre_tool_use = Vec::new();
                    let mut post_tool_use = Vec::new();
                    let mut stop = Vec::new();

                    for hook in enabled_hooks {
                        let commands = resolve_hook_commands(hook);

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
                                    matcher: CODEX_TOOL_MATCHER.to_string(),
                                    hooks: handlers,
                                });
                            }
                            HookTrigger::AfterRun | HookTrigger::AfterFailure => {
                                post_tool_use.push(CodexMatcherGroup {
                                    matcher: CODEX_TOOL_MATCHER.to_string(),
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
                        pre_tool_use: if pre_tool_use.is_empty() {
                            None
                        } else {
                            Some(pre_tool_use)
                        },
                        post_tool_use: if post_tool_use.is_empty() {
                            None
                        } else {
                            Some(post_tool_use)
                        },
                        stop: if stop.is_empty() { None } else { Some(stop) },
                    };

                    let file_content = CodexHooksFile { hooks: codex_hooks };
                    let serialized_file = serde_json::to_string_pretty(&file_content)
                        .map_err(|error| format!("序列化 Codex Hooks JSON 失败：{error}"))?;

                    fs::write(&target_path, serialized_file)
                        .map_err(|error| format!("写入 Codex Hooks 配置文件失败：{error}"))?;
                }
                EditorId::Antigravity | EditorId::Cursor => {
                    let hook_value = if *editor_id == EditorId::Antigravity {
                        build_named_hooks_value(&enabled_hooks, ANTIGRAVITY_TOOL_MATCHER)
                    } else {
                        build_cursor_hooks_value(&enabled_hooks)
                    };
                    let serialized_file = serde_json::to_string_pretty(&hook_value)
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
        target_path: resolve_editor_hooks_path(EditorId::Codex)?
            .display()
            .to_string(),
        updated_at: current_timestamp(),
    })
}

fn encode_hex_utf8(value: &str) -> String {
    value
        .as_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn build_format_current_file_template_command(format_command: &str) -> String {
    let encoded_format_command = encode_hex_utf8(format_command);
    let shell_command = "bash -c 'template=$(echo \"ENCODED_CMD\" | xxd -r -p); files=$(git status --porcelain | awk \"{print \\$2}\"); if [ -n \"$files\" ]; then for f in $files; do if [ -f \"$f\" ]; then if [[ \"$template\" == *\"{{current_file}}\"* ]]; then cmd=\"${template//\\{\\{current_file\\}\\}/$f}\"; else cmd=\"$template $f\"; fi; eval \"$cmd\"; fi; done; fi; echo \"{\\\"continue\\\": true}\"'";
    shell_command.replace("ENCODED_CMD", &encoded_format_command)
}

fn resolve_hook_commands(hook: &HookDefinition) -> Vec<String> {
    match hook.mode {
        HookMode::FormatTemplate => hook
            .format_command
            .as_ref()
            .map(|command| command.trim())
            .filter(|command| !command.is_empty())
            .map(|command| vec![build_format_current_file_template_command(command)])
            .unwrap_or_default(),
        HookMode::Raw => hook
            .commands
            .iter()
            .map(|command| command.command.trim().to_string())
            .filter(|command| !command.is_empty())
            .collect(),
    }
}

fn build_named_hooks_value(hooks: &[&HookDefinition], tool_matcher: &str) -> serde_json::Value {
    let mut file_obj = serde_json::Map::new();

    for hook in hooks {
        let commands = resolve_hook_commands(hook);

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
            .map(|command| {
                serde_json::json!({
                    "type": "command",
                    "command": command,
                    "timeout": 30
                })
            })
            .collect();

        let event_value = if event_name == "Stop" {
            serde_json::json!(handlers)
        } else {
            serde_json::json!([
                {
                    "matcher": tool_matcher,
                    "hooks": handlers
                }
            ])
        };

        let mut hook_entry = serde_json::Map::new();
        hook_entry.insert("enabled".to_string(), serde_json::Value::Bool(true));
        hook_entry.insert(event_name.to_string(), event_value);

        file_obj.insert(hook.name.clone(), serde_json::Value::Object(hook_entry));
    }

    serde_json::Value::Object(file_obj)
}

fn build_cursor_hooks_value(hooks: &[&HookDefinition]) -> serde_json::Value {
    let mut cursor_hooks = serde_json::Map::new();

    for hook in hooks {
        let event_name = match hook.trigger {
            HookTrigger::BeforeRun => "preToolUse",
            HookTrigger::AfterRun => "afterFileEdit",
            HookTrigger::AfterFailure => "postToolUseFailure",
            HookTrigger::BeforeCommit => "stop",
        };

        let handlers: Vec<serde_json::Value> = resolve_hook_commands(hook)
            .iter()
            .map(|command| command.as_str())
            .map(|command| {
                let mut handler = serde_json::Map::new();
                handler.insert(
                    "command".to_string(),
                    serde_json::Value::String(command.to_string()),
                );
                handler.insert("timeout".to_string(), serde_json::Value::Number(30.into()));

                if event_name == "preToolUse" || event_name == "postToolUseFailure" {
                    handler.insert(
                        "matcher".to_string(),
                        serde_json::Value::String(CURSOR_WRITE_TOOL_MATCHER.to_string()),
                    );
                }

                serde_json::Value::Object(handler)
            })
            .collect();

        if handlers.is_empty() {
            continue;
        }

        cursor_hooks
            .entry(event_name.to_string())
            .or_insert_with(|| serde_json::Value::Array(Vec::new()));

        if let Some(serde_json::Value::Array(existing_handlers)) = cursor_hooks.get_mut(event_name) {
            existing_handlers.extend(handlers);
        }
    }

    serde_json::json!({
        "version": 1,
        "hooks": cursor_hooks
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn sample_hook(trigger: HookTrigger) -> HookDefinition {
        HookDefinition {
            id: "format-hook".to_string(),
            name: "格式化".to_string(),
            trigger,
            mode: HookMode::Raw,
            format_command: None,
            commands: vec![HookCommand {
                id: "cmd-1".to_string(),
                command: "pnpm lint --fix".to_string(),
            }],
            enabled_editors: HashMap::new(),
        }
    }

    #[test]
    fn build_named_hooks_value_uses_all_tools_matcher_for_antigravity() {
        let hook = sample_hook(HookTrigger::AfterRun);
        let value = build_named_hooks_value(&[&hook], ANTIGRAVITY_TOOL_MATCHER);

        assert_eq!(
            value["格式化"]["PostToolUse"][0]["matcher"],
            serde_json::Value::String("*".to_string())
        );
    }

    #[test]
    fn build_cursor_hooks_value_uses_write_matcher_for_before_run() {
        let hook = sample_hook(HookTrigger::BeforeRun);
        let value = build_cursor_hooks_value(&[&hook]);

        assert_eq!(
            value["hooks"]["preToolUse"][0]["matcher"],
            serde_json::Value::String(CURSOR_WRITE_TOOL_MATCHER.to_string())
        );
    }

    #[test]
    fn cursor_hooks_preview_should_follow_cursor_native_schema() {
        let hook = sample_hook(HookTrigger::AfterRun);
        let value = build_cursor_hooks_value(&[&hook]);

        assert_eq!(
            value,
            serde_json::json!({
                "version": 1,
                "hooks": {
                    "afterFileEdit": [
                        {
                            "command": "pnpm lint --fix",
                            "timeout": 30
                        }
                    ]
                }
            })
        );
    }

    #[test]
    fn resolve_hook_commands_builds_inline_command_for_format_template() {
        let mut hook = sample_hook(HookTrigger::AfterRun);
        hook.mode = HookMode::FormatTemplate;
        hook.format_command = Some(format!("npx prettier --write {FORMAT_CURRENT_FILE_PLACEHOLDER}"));
        hook.commands = Vec::new();

        let commands = resolve_hook_commands(&hook);

        assert_eq!(commands.len(), 1);
        assert!(commands[0].contains("xxd -r -p"));
        assert!(commands[0].contains("git status --porcelain"));
        assert!(commands[0].contains("awk"));
        assert!(commands[0].contains(&encode_hex_utf8(&format!(
            "npx prettier --write {FORMAT_CURRENT_FILE_PLACEHOLDER}"
        ))));
    }
}
