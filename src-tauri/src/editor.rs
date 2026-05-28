use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use crate::utils::get_home_dir;

#[derive(Deserialize, Serialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum EditorId {
    Antigravity,
    Codex,
    Cursor,
}

pub fn resolve_editor_agents_path(editor_id: EditorId) -> Result<PathBuf, String> {
    match editor_id {
        EditorId::Antigravity => resolve_antigravity_agents_path(),
        EditorId::Codex => resolve_codex_agents_path(),
        EditorId::Cursor => resolve_cursor_agents_path(),
    }
}

pub fn resolve_editor_mcp_path(editor_id: EditorId) -> Result<PathBuf, String> {
    let home_path = get_home_dir()?;

    match editor_id {
        EditorId::Antigravity => Ok(home_path
            .join(".gemini")
            .join("antigravity")
            .join("mcp_config.json")),
        EditorId::Codex => Ok(home_path.join(".codex").join("config.toml")),
        EditorId::Cursor => Ok(home_path.join(".cursor").join("mcp.json")),
    }
}

pub fn resolve_editor_skills_path(editor_id: EditorId) -> Result<PathBuf, String> {
    let home = get_home_dir()?;
    match editor_id {
        EditorId::Antigravity => Ok(home.join(".gemini").join("antigravity").join("skills")),
        EditorId::Codex => Ok(home.join(".codex").join("skills")),
        EditorId::Cursor => Ok(home.join(".cursor").join("skills")),
    }
}

pub fn is_editor_skills_target_path(path: &Path) -> bool {
    let Ok(home) = get_home_dir() else {
        return false;
    };
    let candidate = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let target_roots = [
        home.join(".codex").join("skills"),
        home.join(".cursor").join("skills"),
        home.join(".gemini").join("antigravity").join("skills"),
    ];

    target_roots.iter().any(|target_root| {
        let canonical_root = std::fs::canonicalize(target_root).unwrap_or_else(|_| target_root.clone());
        candidate.starts_with(canonical_root)
    })
}

fn resolve_antigravity_agents_path() -> Result<PathBuf, String> {
    let home_directory = get_home_dir()?;
    Ok(home_directory.join(".gemini").join("GEMINI.md"))
}

fn resolve_codex_agents_path() -> Result<PathBuf, String> {
    let home_directory = get_home_dir()?;
    Ok(home_directory.join(".codex").join("AGENTS.md"))
}

fn resolve_cursor_agents_path() -> Result<PathBuf, String> {
    let home_directory = get_home_dir()?;
    Ok(home_directory.join(".cursor").join("AGENTS.md"))
}
