use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use crate::editor::EditorId;
use crate::utils::get_home_dir;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EditorAccountInfo {
    pub name: String,
    pub is_active: bool,
    pub last_modified: u64,
}

// 供 Tauri 调用的真实接口
#[tauri::command]
pub fn load_editor_accounts(editor_id: EditorId) -> Result<Vec<EditorAccountInfo>, String> {
    load_accounts_impl(editor_id, None)
}

#[tauri::command]
pub fn save_current_editor_account(editor_id: EditorId, name: String) -> Result<(), String> {
    save_current_account_impl(editor_id, name, None)
}

#[tauri::command]
pub fn switch_editor_account(editor_id: EditorId, name: String) -> Result<(), String> {
    switch_account_impl(editor_id, name, None)
}

#[tauri::command]
pub fn delete_editor_account(editor_id: EditorId, name: String) -> Result<(), String> {
    delete_account_impl(editor_id, name, None)
}

// 辅助函数：校验账号名称是否安全
fn is_safe_account_name(name: &str) -> bool {
    if name.is_empty() || name.contains("..") {
        return false;
    }
    name.chars().all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '@' | '.'))
}

// 辅助函数：解析凭证文件物理路径
fn resolve_auth_file_path(
    editor_id: EditorId,
    custom_home: Option<&Path>,
) -> Result<(PathBuf, String, String), String> {
    let home = match custom_home {
        Some(path) => path.to_path_buf(),
        None => get_home_dir()?,
    };

    match editor_id {
        EditorId::Codex => {
            let codex_dir = home.join(".codex");
            Ok((codex_dir.join("auth.json"), "auth".to_string(), "json".to_string()))
        }
        EditorId::Cursor => {
            let db_dir = if custom_home.is_some() {
                home.join("Cursor").join("User").join("globalStorage")
            } else {
                #[cfg(target_os = "macos")]
                {
                    home.join("Library")
                        .join("Application Support")
                        .join("Cursor")
                        .join("User")
                        .join("globalStorage")
                }
                #[cfg(target_os = "windows")]
                {
                    let appdata = std::env::var("APPDATA")
                        .map(PathBuf::from)
                        .unwrap_or_else(|_| home.join("AppData").join("Roaming"));
                    appdata.join("Cursor").join("User").join("globalStorage")
                }
                #[cfg(not(any(target_os = "macos", target_os = "windows")))]
                {
                    home.join(".config")
                        .join("Cursor")
                        .join("User")
                        .join("globalStorage")
                }
            };
            Ok((db_dir.join("state.vscdb"), "state".to_string(), "vscdb".to_string()))
        }
        EditorId::Antigravity => Err("Antigravity 暂不支持账号管理".to_string()),
    }
}

// 内部实现，接受 custom_home 方便 TDD
pub fn load_accounts_impl(
    editor_id: EditorId,
    custom_home: Option<&Path>,
) -> Result<Vec<EditorAccountInfo>, String> {
    let (auth_file, prefix, ext) = resolve_auth_file_path(editor_id, custom_home)?;
    let parent_dir = auth_file.parent().ok_or_else(|| "无法获取凭证文件目录。".to_string())?;

    if !parent_dir.exists() {
        return Ok(Vec::new());
    }

    // 计算当前激活凭据文件的内容哈希
    let active_hash = if auth_file.exists() {
        std::fs::read(&auth_file)
            .map(|data| {
                use std::hash::{Hash, Hasher};
                let mut hasher = std::collections::hash_map::DefaultHasher::new();
                data.hash(&mut hasher);
                hasher.finish()
            })
            .ok()
    } else {
        None
    };

    let mut accounts = Vec::new();
    let entries = std::fs::read_dir(parent_dir)
        .map_err(|err| format!("读取凭证目录失败: {}", err))?;

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let file_name = path.file_name().unwrap_or_default().to_string_lossy();
        if file_name.starts_with(&format!("{}-", prefix)) && file_name.ends_with(&format!(".{}", ext)) {
            let name_part = &file_name[prefix.len() + 1..file_name.len() - ext.len() - 1];
            if !is_safe_account_name(name_part) {
                continue;
            }

            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            let last_modified = metadata
                .modified()
                .unwrap_or_else(|_| std::time::SystemTime::now())
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            // 如果内容哈希一致，说明为当前活跃的账号
            let is_active = if let Some(a_hash) = active_hash {
                std::fs::read(&path)
                    .map(|data| {
                        use std::hash::{Hash, Hasher};
                        let mut hasher = std::collections::hash_map::DefaultHasher::new();
                        data.hash(&mut hasher);
                        hasher.finish() == a_hash
                    })
                    .unwrap_or(false)
            } else {
                false
            };

            accounts.push(EditorAccountInfo {
                name: name_part.to_string(),
                is_active,
                last_modified,
            });
        }
    }

    accounts.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    Ok(accounts)
}

pub fn save_current_account_impl(
    editor_id: EditorId,
    name: String,
    custom_home: Option<&Path>,
) -> Result<(), String> {
    if !is_safe_account_name(&name) {
        return Err("非法账号名称，仅允许使用字母、数字、下划线及短横线。".to_string());
    }

    let (auth_file, prefix, ext) = resolve_auth_file_path(editor_id, custom_home)?;
    if !auth_file.exists() {
        return Err("未找到当前登录的凭证文件，请先在编辑器中登录。".to_string());
    }

    let parent_dir = auth_file.parent().ok_or_else(|| "无法获取凭证文件目录。".to_string())?;
    // 确保备份目录一定存在
    if !parent_dir.exists() {
        std::fs::create_dir_all(parent_dir).map_err(|e| format!("创建配置目录失败: {}", e))?;
    }
    
    let dest_file = parent_dir.join(format!("{}-{}.{}", prefix, name, ext));
    std::fs::copy(&auth_file, &dest_file)
        .map(|_| ())
        .map_err(|err| format!("备份账号凭证失败: {}", err))
}

pub fn switch_account_impl(
    editor_id: EditorId,
    name: String,
    custom_home: Option<&Path>,
) -> Result<(), String> {
    if !is_safe_account_name(&name) {
        return Err("非法账号名称，仅允许使用字母、数字、下划线及短横线。".to_string());
    }

    let (auth_file, prefix, ext) = resolve_auth_file_path(editor_id, custom_home)?;
    let parent_dir = auth_file.parent().ok_or_else(|| "无法获取凭证文件目录。".to_string())?;
    let src_file = parent_dir.join(format!("{}-{}.{}", prefix, name, ext));

    if !src_file.exists() {
        return Err(format!("未找到名为 '{}' 的账号凭证备份。", name));
    }

    // 覆盖目标原文件
    std::fs::copy(&src_file, &auth_file)
        .map(|_| ())
        .map_err(|err| format!("恢复账号凭证失败: {}", err))?;

    // 特殊处理 Cursor：自动清理缓存文件
    if editor_id == EditorId::Cursor {
        let wal_file = parent_dir.join("state.vscdb-wal");
        let shm_file = parent_dir.join("state.vscdb-shm");
        let journal_file = parent_dir.join("state.vscdb-journal");

        if wal_file.exists() {
            let _ = std::fs::remove_file(wal_file);
        }
        if shm_file.exists() {
            let _ = std::fs::remove_file(shm_file);
        }
        if journal_file.exists() {
            let _ = std::fs::remove_file(journal_file);
        }
    }

    Ok(())
}

pub fn delete_account_impl(
    editor_id: EditorId,
    name: String,
    custom_home: Option<&Path>,
) -> Result<(), String> {
    if !is_safe_account_name(&name) {
        return Err("非法账号名称，仅允许使用字母、数字、下划线及短横线。".to_string());
    }

    let (auth_file, prefix, ext) = resolve_auth_file_path(editor_id, custom_home)?;
    let parent_dir = auth_file.parent().ok_or_else(|| "无法获取凭证文件目录。".to_string())?;
    let target_file = parent_dir.join(format!("{}-{}.{}", prefix, name, ext));

    if target_file.exists() {
        std::fs::remove_file(target_file)
            .map_err(|err| format!("删除备份失败: {}", err))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_dir(name: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("ai-compose-test-account-{name}-{timestamp}"))
    }

    #[test]
    fn test_unsupported_editor_returns_error() {
        assert!(load_accounts_impl(EditorId::Antigravity, None).is_err());
        assert!(save_current_account_impl(EditorId::Antigravity, "work".to_string(), None).is_err());
    }

    #[test]
    fn test_invalid_account_name_validation() {
        let invalid_names = vec![
            "../hack",
            "hack/back",
            "work;rm -rf",
            "personal\\test",
            "",
            "a*b",
            "..",
            "work..test",
        ];

        for name in invalid_names {
            assert!(
                save_current_account_impl(EditorId::Codex, name.to_string(), None).is_err(),
                "Should reject invalid account name: {}",
                name
            );
            assert!(
                switch_account_impl(EditorId::Codex, name.to_string(), None).is_err(),
                "Should reject invalid account name in switch: {}",
                name
            );
            assert!(
                delete_account_impl(EditorId::Codex, name.to_string(), None).is_err(),
                "Should reject invalid account name in delete: {}",
                name
            );
        }
    }

    #[test]
    fn test_valid_account_name_validation() {
        let valid_names = vec![
            "fengyueran@gmail.com",
            "user.name@domain.co",
            "work-1.0",
            "personal_account",
        ];

        for name in valid_names {
            let root = unique_test_dir("valid-names");
            let codex_dir = root.join(".codex");
            fs::create_dir_all(&codex_dir).unwrap();
            fs::write(codex_dir.join("auth.json"), "mock-token").unwrap();

            assert!(
                save_current_account_impl(EditorId::Codex, name.to_string(), Some(&root)).is_ok(),
                "Should accept valid account name: {}",
                name
            );

            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn test_codex_account_switching_flow() {
        let root = unique_test_dir("codex");
        let codex_dir = root.join(".codex");
        fs::create_dir_all(&codex_dir).unwrap();

        // 1. 当没有 auth.json 时，尝试备份应该返回错误
        assert!(save_current_account_impl(EditorId::Codex, "work".to_string(), Some(&root)).is_err());

        // 2. 写入模拟的 auth.json
        let auth_path = codex_dir.join("auth.json");
        fs::write(&auth_path, "token-work-123").unwrap();

        // 3. 备份为 "work"
        save_current_account_impl(EditorId::Codex, "work".to_string(), Some(&root)).unwrap();
        assert!(codex_dir.join("auth-work.json").exists());

        // 4. 加载账号列表，应该发现 "work" 且 isActive 为 true
        let accounts = load_accounts_impl(EditorId::Codex, Some(&root)).unwrap();
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].name, "work");
        assert!(accounts[0].is_active);

        // 5. 修改当前登录的 auth.json，模拟登录了新账号
        fs::write(&auth_path, "token-personal-456").unwrap();

        // 6. 再次加载账号列表，由于 auth.json 内容已改变，"work" 应该变为非 active
        let accounts = load_accounts_impl(EditorId::Codex, Some(&root)).unwrap();
        assert_eq!(accounts.len(), 1);
        assert!(!accounts[0].is_active);

        // 7. 备份新账号为 "personal"
        save_current_account_impl(EditorId::Codex, "personal".to_string(), Some(&root)).unwrap();

        // 8. 列表加载，应该有两个账号，且 "personal" 是激活的，"work" 是非激活的
        let accounts = load_accounts_impl(EditorId::Codex, Some(&root)).unwrap();
        assert_eq!(accounts.len(), 2);
        let work_acct = accounts.iter().find(|a| a.name == "work").unwrap();
        let pers_acct = accounts.iter().find(|a| a.name == "personal").unwrap();
        assert!(!work_acct.is_active);
        assert!(pers_acct.is_active);

        // 9. 切换回 "work"
        switch_account_impl(EditorId::Codex, "work".to_string(), Some(&root)).unwrap();
        let current_token = fs::read_to_string(&auth_path).unwrap();
        assert_eq!(current_token, "token-work-123");

        // 10. 验证切换后列表里 "work" 重新变成活跃
        let accounts = load_accounts_impl(EditorId::Codex, Some(&root)).unwrap();
        let work_acct = accounts.iter().find(|a| a.name == "work").unwrap();
        assert!(work_acct.is_active);

        // 11. 删除 "personal" 账号
        delete_account_impl(EditorId::Codex, "personal".to_string(), Some(&root)).unwrap();
        assert!(!codex_dir.join("auth-personal.json").exists());
        let accounts = load_accounts_impl(EditorId::Codex, Some(&root)).unwrap();
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].name, "work");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn test_cursor_account_switching_flow() {
        let root = unique_test_dir("cursor");
        let cursor_dir = root.join("Cursor").join("User").join("globalStorage");
        fs::create_dir_all(&cursor_dir).unwrap();

        let db_path = cursor_dir.join("state.vscdb");
        fs::write(&db_path, "db-work-content").unwrap();

        // 备份为 "work"
        save_current_account_impl(EditorId::Cursor, "work".to_string(), Some(&root)).unwrap();
        assert!(cursor_dir.join("state-work.vscdb").exists());

        // 模拟切换场景，并且此时有 wal/shm 临时缓存存在
        fs::write(&db_path, "db-personal-content").unwrap();
        save_current_account_impl(EditorId::Cursor, "personal".to_string(), Some(&root)).unwrap();

        // 写入 wal/shm 文件以测试自动清理
        let wal_path = cursor_dir.join("state.vscdb-wal");
        let shm_path = cursor_dir.join("state.vscdb-shm");
        fs::write(&wal_path, "wal-temp-data").unwrap();
        fs::write(&shm_path, "shm-temp-data").unwrap();

        // 切换回 "work"
        switch_account_impl(EditorId::Cursor, "work".to_string(), Some(&root)).unwrap();

        // 验证 db 文件已被覆盖为 work，且 wal 和 shm 临时文件被删除
        assert_eq!(fs::read_to_string(&db_path).unwrap(), "db-work-content");
        assert!(!wal_path.exists());
        assert!(!shm_path.exists());

        fs::remove_dir_all(root).unwrap();
    }
}
