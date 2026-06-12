use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tokio::process::Command as AsyncCommand;
use crate::editor::{
    EditorId, resolve_editor_skills_path, is_editor_skills_target_path,
};
use crate::utils::{
    ApplyAction, current_timestamp, get_home_dir, is_safe_skill_id,
    npx_command_name, normalize_repo_source,
};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub content: String,
    pub path: String,
    pub source_kind: SkillSourceKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_skill_path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CliSkillRepoMetadata {
    pub repo_source: String,
    pub repo_skill_path: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SkillSourceKind {
    Cli,
    FallbackDirectory,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EditorSkillsState {
    pub enabled: bool,
    pub target_path: String,
    pub enabled_skills: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorSkillsStates {
    pub antigravity: EditorSkillsState,
    pub codex: EditorSkillsState,
    pub cursor: EditorSkillsState,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplySkillsPayload {
    pub editor_id: EditorId,
    pub enabled: bool,
    pub enabled_skills: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlinkSkillPayload {
    pub editor_id: EditorId,
    pub skill_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkSkillPayload {
    pub editor_id: EditorId,
    pub skill_id: String,
    pub skill_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadSingleSkillPayload {
    pub id: String,
    pub path: String,
    pub source_kind: SkillSourceKind,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadEditorInstalledSkillsPayload {
    pub editor_id: EditorId,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplySkillsResult {
    pub action: ApplyAction,
    pub editor_id: EditorId,
    pub target_path: String,
    pub updated_at: String,
}

pub fn resolve_skills_cli_lock_path() -> Result<PathBuf, String> {
    Ok(get_home_dir()?.join(".agents").join(".skill-lock.json"))
}

pub fn load_skills_cli_lock_json() -> Option<serde_json::Value> {
    let Ok(lock_path) = resolve_skills_cli_lock_path() else {
        return None;
    };
    let Ok(lock_content) = fs::read_to_string(lock_path) else {
        return None;
    };
    serde_json::from_str::<serde_json::Value>(&lock_content).ok()
}

pub fn load_skills_cli_lock_ids() -> std::collections::HashSet<String> {
    let Some(lock_json) = load_skills_cli_lock_json() else {
        return std::collections::HashSet::new();
    };

    lock_json
        .get("skills")
        .and_then(|skills| skills.as_object())
        .map(|skills| skills.keys().cloned().collect())
        .unwrap_or_default()
}

fn split_repo_source(repo: &str) -> Option<(String, Option<String>)> {
    let normalized = normalize_repo_source(repo)?;
    let parts = normalized.split('/').collect::<Vec<_>>();
    if parts.len() < 2 {
        return None;
    }

    let repo_root = format!("{}/{}", parts[0], parts[1]);
    let subpath = if parts.len() > 2 {
        Some(parts[2..].join("/"))
    } else {
        None
    };

    Some((repo_root, subpath))
}

fn normalize_repo_skill_directory(skill_path: &str) -> String {
    skill_path
        .trim_end_matches('/')
        .strip_suffix("/SKILL.md")
        .or_else(|| skill_path.strip_suffix("SKILL.md"))
        .unwrap_or(skill_path)
        .trim_end_matches('/')
        .to_string()
}

pub(crate) fn repo_request_matches_skill(
    requested_repo: &str,
    installed_repo: &str,
    installed_skill_path: Option<&str>,
) -> bool {
    let Some((requested_root, requested_subpath)) = split_repo_source(requested_repo) else {
        return false;
    };

    if installed_repo != requested_root {
        return false;
    }

    let Some(requested_subpath) = requested_subpath else {
        return true;
    };

    let Some(installed_skill_path) = installed_skill_path else {
        return false;
    };
    let installed_directory = normalize_repo_skill_directory(installed_skill_path);

    installed_directory == requested_subpath
        || installed_directory.starts_with(&format!("{requested_subpath}/"))
}

pub fn load_skills_cli_ids_by_repo(repo: &str) -> std::collections::HashSet<String> {
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
                    let skill_path = entry.get("skillPath").and_then(|value| value.as_str());
                    if repo_request_matches_skill(repo, source, skill_path) {
                        Some(skill_id.clone())
                    } else {
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn load_skills_cli_repo_sources() -> std::collections::HashMap<String, CliSkillRepoMetadata> {
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
                    let skill_path = entry
                        .get("skillPath")
                        .and_then(|value| value.as_str())
                        .map(|value| value.to_string());
                    Some((
                        skill_id.clone(),
                        CliSkillRepoMetadata {
                            repo_source: source.to_string(),
                            repo_skill_path: skill_path,
                        },
                    ))
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn classify_cli_skill_source(
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

pub fn load_single_skill(
    path: &Path,
    id: &str,
    source_kind: SkillSourceKind,
    repo_source: Option<String>,
    repo_skill_path: Option<String>,
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
        repo_skill_path,
    })
}

pub fn extract_skill_source_entries(value: &serde_json::Value) -> Vec<(String, PathBuf)> {
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

pub fn collect_skills_from_directory(
    directory: &Path,
    managed_skill_ids: &std::collections::HashSet<String>,
    repo_sources: &std::collections::HashMap<String, CliSkillRepoMetadata>,
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
        let (repo_source, repo_skill_path) = if source_kind == SkillSourceKind::Cli {
            repo_sources
                .get(&skill_id)
                .map(|metadata| {
                    (
                        Some(metadata.repo_source.clone()),
                        metadata.repo_skill_path.clone(),
                    )
                })
                .unwrap_or((None, None))
        } else {
            (None, None)
        };
        if let Some(skill) = load_single_skill(
            &source_path,
            &skill_id,
            source_kind,
            repo_source,
            repo_skill_path,
        ) {
            if loaded_ids.insert(skill.id.clone()) {
                skills.push(skill);
            }
        }
    }

    skills
}

pub fn resolve_global_skills_root() -> Result<PathBuf, String> {
    Ok(get_home_dir()?.join(".agents").join("skills"))
}

pub fn load_global_skills() -> Result<Vec<SkillInfo>, String> {
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

pub fn load_editor_installed_skills_inner(editor_id: EditorId) -> Result<Vec<SkillInfo>, String> {
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

pub async fn load_physical_skills_inner() -> Result<Vec<SkillInfo>, String> {
    load_global_skills()
}

#[tauri::command]
pub async fn load_physical_skills() -> Result<Vec<SkillInfo>, String> {
    load_physical_skills_inner().await
}

pub fn is_skill_enabled(editor_skills_dir: &Path, skill_id: &str, physical_skill_path: &Path) -> bool {
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

pub fn build_editor_skills_state(editor_id: EditorId) -> Result<EditorSkillsState, String> {
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
pub async fn load_editor_skills_states() -> Result<EditorSkillsStates, String> {
    Ok(EditorSkillsStates {
        antigravity: build_editor_skills_state(EditorId::Antigravity)?,
        codex: build_editor_skills_state(EditorId::Codex)?,
        cursor: build_editor_skills_state(EditorId::Cursor)?,
    })
}

#[tauri::command]
pub async fn load_editor_installed_skills(
    payload: LoadEditorInstalledSkillsPayload,
) -> Result<Vec<SkillInfo>, String> {
    load_editor_installed_skills_inner(payload.editor_id)
}

#[cfg(unix)]
pub fn create_symlink<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> std::io::Result<()> {
    std::os::unix::fs::symlink(original, link)
}

#[cfg(windows)]
pub fn create_symlink<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> std::io::Result<()> {
    std::os::windows::fs::symlink_dir(original, link)
}

pub fn remove_link_or_dir(path: &Path) -> std::io::Result<()> {
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
pub async fn apply_skills_to_editor_target(
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
pub async fn unlink_skill_from_editor(
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
pub async fn link_skill_to_editor(payload: LinkSkillPayload) -> Result<ApplySkillsResult, String> {
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
pub async fn load_single_skill_command(payload: LoadSingleSkillPayload) -> Result<SkillInfo, String> {
    let (repo_source, repo_skill_path) = if payload.source_kind == SkillSourceKind::Cli {
        load_skills_cli_repo_sources()
            .get(&payload.id)
            .map(|metadata| {
                (
                    Some(metadata.repo_source.clone()),
                    metadata.repo_skill_path.clone(),
                )
            })
            .unwrap_or((None, None))
    } else {
        (None, None)
    };
    load_single_skill(
        Path::new(&payload.path),
        &payload.id,
        payload.source_kind,
        repo_source,
        repo_skill_path,
    )
    .ok_or_else(|| format!("无法读取技能 {} 的最新内容。", payload.id))
}

#[tauri::command]
pub async fn load_skills_from_dir(path: String) -> Result<Vec<SkillInfo>, String> {
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
pub async fn add_skills_repository(repo: String) -> Result<Vec<SkillInfo>, String> {
    let Some(repo_trimmed) = normalize_repo_source(&repo) else {
        return Err(
            "仓库源必须使用 owner/repo 或 owner/repo/path 格式，或提供对应的 GitHub 仓库/目录链接；且只能包含字母、数字、点、下划线和短横线。"
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
pub async fn update_skill(skill_id: String) -> Result<String, String> {
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
pub async fn remove_skill(skill_id: String) -> Result<String, String> {
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
