mod utils;
mod editor;
mod prompt;
mod mcp;
mod skills;
mod system;
mod hooks;
mod account;

use prompt::{apply_prompt_to_editor_target, load_editor_target_states};
use mcp::{apply_mcp_to_editor_target, load_editor_mcp_states};
use hooks::{apply_hooks_to_editor_target, load_editor_hooks_states};
use skills::{
    load_physical_skills, load_editor_skills_states, load_editor_installed_skills,
    load_skills_from_dir, apply_skills_to_editor_target, unlink_skill_from_editor,
    link_skill_to_editor, load_single_skill_command, add_skills_repository,
    update_skill, remove_skill,
};
use system::{
    open_external_url, open_local_path, reveal_local_path, select_directory,
    export_configuration, import_configuration,
};
use account::{
    load_editor_accounts, save_current_editor_account,
    switch_editor_account, delete_editor_account,
    fetch_editor_account_usage,
};

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
            select_directory,
            apply_hooks_to_editor_target,
            load_editor_hooks_states,
            load_editor_accounts,
            save_current_editor_account,
            switch_editor_account,
            delete_editor_account,
            fetch_editor_account_usage,
            export_configuration,
            import_configuration
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};
    use editor::{EditorId, resolve_editor_mcp_path, resolve_editor_skills_path};
    use mcp::build_editor_mcp_state;
    use skills::{
        build_editor_skills_state, load_single_skill, SkillSourceKind,
        extract_skill_source_entries, collect_skills_from_directory,
        is_skill_enabled, create_symlink, classify_cli_skill_source,
        repo_request_matches_skill, CliSkillRepoMetadata,
    };
    use utils::{
        get_home_dir, is_safe_repo_source, is_safe_external_url,
        is_safe_local_path, normalize_repo_source, is_safe_skill_id,
    };

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
        }
    }

    #[test]
    fn test_build_antigravity_mcp_state() {
        let state = build_editor_mcp_state(EditorId::Antigravity).unwrap();
        assert!(state.target_path.contains(".gemini"));
        assert!(state.target_path.contains("antigravity"));
        assert!(state.target_path.contains("mcp_config.json"));
        if std::path::Path::new(&state.target_path).exists() {
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
            Some("skills/react-development/SKILL.md".to_string()),
        )
        .unwrap();
        assert_eq!(skill.id, "react-development");
        assert_eq!(skill.name, "React Development");
        assert_eq!(skill.description, "React task router");
        assert_eq!(skill.content, "# Usage\n\nUse it.");
        assert_eq!(skill.source_kind, SkillSourceKind::Cli);
        assert_eq!(skill.repo_source.as_deref(), Some("fengyueran/skills"));
        assert_eq!(
            skill.repo_skill_path.as_deref(),
            Some("skills/react-development/SKILL.md")
        );

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
            CliSkillRepoMetadata {
                repo_source: "vercel-labs/skills".to_string(),
                repo_skill_path: Some("skills/find-skills/SKILL.md".to_string()),
            },
        )]);
        let skills =
            collect_skills_from_directory(&root.join("editor"), &managed_ids, &repo_sources);
        assert_eq!(skills.len(), 2);
        assert!(skills.iter().any(|skill| skill.id == "find-skills"
            && skill.source_kind == SkillSourceKind::Cli
            && skill.repo_source.as_deref() == Some("vercel-labs/skills")
            && skill.repo_skill_path.as_deref() == Some("skills/find-skills/SKILL.md")));
        assert!(skills.iter().any(|skill| skill.id == "local-skill"
            && skill.source_kind == SkillSourceKind::FallbackDirectory
            && skill.repo_source.is_none()));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn test_repo_request_matches_subpath_scoped_skill() {
        assert!(repo_request_matches_skill(
            "github/awesome-copilot/skills/refactor",
            "github/awesome-copilot",
            Some("skills/refactor/SKILL.md"),
        ));
        assert!(!repo_request_matches_skill(
            "github/awesome-copilot/skills/refactor",
            "github/awesome-copilot",
            Some("skills/review-and-refactor/SKILL.md"),
        ));
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
            normalize_repo_source("https://github.com/github/awesome-copilot/tree/main/skills/refactor"),
            Some("github/awesome-copilot/skills/refactor".to_string())
        );
        assert_eq!(
            normalize_repo_source("github/awesome-copilot/skills/refactor"),
            Some("github/awesome-copilot/skills/refactor".to_string())
        );
        assert_eq!(
            normalize_repo_source("https://github.com/vercel-labs/agent-skills/tree/main"),
            Some("vercel-labs/agent-skills".to_string())
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
