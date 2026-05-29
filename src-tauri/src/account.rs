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

// 辅助函数：活跃账号标记文件路径（极小文件，只存账号名）
fn active_marker_path(parent_dir: &Path, prefix: &str) -> PathBuf {
    parent_dir.join(format!(".{}.active", prefix))
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

#[derive(Deserialize)]
struct CodexAuthTokens {
    account_id: Option<String>,
}

#[derive(Deserialize)]
struct CodexAuthFile {
    tokens: Option<CodexAuthTokens>,
}

fn get_codex_account_id(path: &Path) -> Option<String> {
    let content = std::fs::read_to_string(path).ok()?;
    let auth: CodexAuthFile = serde_json::from_str(&content).ok()?;
    auth.tokens.and_then(|t| t.account_id)
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

    let marker_path = active_marker_path(parent_dir, &prefix);
    let mut active_name: Option<String> = None;

    if marker_path.exists() {
        if let Ok(marker_content) = std::fs::read_to_string(&marker_path) {
            let marker_content = marker_content.trim();
            if let Some((name, saved_size_str)) = marker_content.split_once(':') {
                if let Ok(saved_size) = saved_size_str.parse::<u64>() {
                    let current_size = std::fs::metadata(&auth_file).map(|m| m.len()).unwrap_or(0);
                    if editor_id == EditorId::Cursor {
                        // 对于 Cursor，不进行大小校验，只要标记存在，就信任标记账号
                        // 这样能有效避免因 Cursor 运行时频繁写入 state.vscdb 导致激活态自动失效
                        active_name = Some(name.to_string());
                    } else if current_size == saved_size {
                        active_name = Some(name.to_string());
                    } else {
                        // 对于 Codex，如果大小不一致，我们解析 account_id 进行深度校验
                        // 这样即使 Token 刷新导致大小改变，只要账号一致依然保持激活
                        let backup_file = parent_dir.join(format!("{}-{}.{}", prefix, name, ext));
                        let current_id = get_codex_account_id(&auth_file);
                        let backup_id = get_codex_account_id(&backup_file);
                        if current_id.is_some() && current_id == backup_id {
                            active_name = Some(name.to_string());
                            // 自动静默同步：把最新凭证写回备份文件，防止切回时由于使用过期 Token 导致失效
                            let _ = std::fs::copy(&auth_file, &backup_file);
                            // 顺便把新的大小写回标记文件，加速下一次 load
                            let _ = std::fs::write(&marker_path, format!("{}:{}", name, current_size));
                        }
                    }
                }
            }
        }
    }

    // Fallback 机制：如果仍然没有识别出激活账号，且当前凭证文件存在
    if active_name.is_none() && auth_file.exists() {
        if let Ok(entries) = std::fs::read_dir(parent_dir) {
            for entry in entries.flatten() {
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

                    let current_size = std::fs::metadata(&auth_file).map(|m| m.len()).unwrap_or(0);
                    let backup_size = entry.metadata().map(|m| m.len()).unwrap_or(0);

                    let mut matched = false;
                    if editor_id == EditorId::Codex {
                        // Codex 深度匹配：先比对大小和哈希，如果对不上，再比对 account_id
                        if current_size == backup_size {
                            if let (Ok(c1), Ok(c2)) = (std::fs::read(&auth_file), std::fs::read(&path)) {
                                matched = c1 == c2;
                            }
                        }
                        if !matched {
                            let current_id = get_codex_account_id(&auth_file);
                            let backup_id = get_codex_account_id(&path);
                            if current_id.is_some() && current_id == backup_id {
                                matched = true;
                                // 自动静默同步：把最新凭证写回备份文件
                                let _ = std::fs::copy(&auth_file, &path);
                            }
                        }
                    } else if editor_id == EditorId::Cursor {
                        // Cursor 快速匹配：如果大小和内容哈希一致
                        if current_size == backup_size {
                            if let (Ok(c1), Ok(c2)) = (std::fs::read(&auth_file), std::fs::read(&path)) {
                                matched = c1 == c2;
                            }
                        }
                    }

                    if matched {
                        active_name = Some(name_part.to_string());
                        // 写入标记文件以供后续快速使用
                        let _ = std::fs::write(&marker_path, format!("{}:{}", name_part, current_size));
                        break;
                    }
                }
            }
        }
    }

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

            let is_active = active_name.as_deref() == Some(name_part);

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
    if !parent_dir.exists() {
        std::fs::create_dir_all(parent_dir).map_err(|e| format!("创建配置目录失败: {}", e))?;
    }

    let dest_file = parent_dir.join(format!("{}-{}.{}", prefix, name, ext));
    std::fs::copy(&auth_file, &dest_file)
        .map_err(|err| format!("备份账号凭证失败: {}", err))?;

    // 写入活跃账号标记："name:size" 格式，用文件大小做快速核验
    let auth_size = std::fs::metadata(&auth_file)
        .map(|m| m.len())
        .unwrap_or(0);
    std::fs::write(
        active_marker_path(parent_dir, &prefix),
        format!("{}:{}", name, auth_size).as_bytes(),
    )
    .map_err(|err| format!("写入活跃账号标记失败: {}", err))
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

    // 在覆盖前，若当前存在活跃账号标记，自动将当前正在被替换的原凭据文件静默同步归档回其对应的备份中
    // 这样能够保证当前账号的最新凭证（如自动刷新后的 Token 或 Cursor 聊天记录等）在切走时不丢失，防止切回时由于使用过期/已使用过的 Token 导致失效
    let marker_path = active_marker_path(parent_dir, &prefix);
    if marker_path.exists() && auth_file.exists() {
        if let Ok(marker_content) = std::fs::read_to_string(&marker_path) {
            let marker_content = marker_content.trim();
            if let Some((active_name, _)) = marker_content.split_once(':') {
                if is_safe_account_name(active_name) && active_name != name {
                    let active_backup = parent_dir.join(format!("{}-{}.{}", prefix, active_name, ext));
                    if active_backup.exists() {
                        let _ = std::fs::copy(&auth_file, &active_backup);
                    }
                }
            }
        }
    }

    // 覆盖目标原文件
    std::fs::copy(&src_file, &auth_file)
        .map_err(|err| format!("恢复账号凭证失败: {}", err))?;

    // 更新活跃账号标记："name:size" 格式
    let switched_size = std::fs::metadata(&auth_file)
        .map(|m| m.len())
        .unwrap_or(0);
    std::fs::write(
        active_marker_path(parent_dir, &prefix),
        format!("{}:{}", name, switched_size).as_bytes(),
    )
    .map_err(|err| format!("更新活跃账号标记失败: {}", err))?;

    // 特殊处理 Cursor：自动清理缓存文件
    if editor_id == EditorId::Cursor {
        let wal_file = parent_dir.join("state.vscdb-wal");
        let shm_file = parent_dir.join("state.vscdb-shm");
        let journal_file = parent_dir.join("state.vscdb-journal");

        if wal_file.exists() { let _ = std::fs::remove_file(wal_file); }
        if shm_file.exists() { let _ = std::fs::remove_file(shm_file); }
        if journal_file.exists() { let _ = std::fs::remove_file(journal_file); }
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
    let _ = auth_file; // 仅用于 resolve，删除操作不涉及原文件
    let target_file = parent_dir.join(format!("{}-{}.{}", prefix, name, ext));

    if target_file.exists() {
        std::fs::remove_file(&target_file)
            .map_err(|err| format!("删除备份失败: {}", err))?;
    }

    // 若删除的是当前活跃账号，清除标记
    let marker = active_marker_path(parent_dir, &prefix);
    if let Ok(current) = std::fs::read_to_string(&marker) {
        if current.trim().split_once(':').map(|(n, _)| n).unwrap_or(current.trim()) == name {
            let _ = std::fs::remove_file(&marker);
        }
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

        // 8.5 模拟 personal 在运行期间刷新了 Token 导致内容变动
        fs::write(&auth_path, "token-personal-refreshed-999").unwrap();

        // 9. 切换回 "work"
        switch_account_impl(EditorId::Codex, "work".to_string(), Some(&root)).unwrap();
        let current_token = fs::read_to_string(&auth_path).unwrap();
        assert_eq!(current_token, "token-work-123");

        // 验证 personal 的备份文件自动静默同步归档了刷新后的 Token
        let personal_backup_content = fs::read_to_string(codex_dir.join("auth-personal.json")).unwrap();
        assert_eq!(personal_backup_content, "token-personal-refreshed-999");

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

    #[test]
    fn test_codex_active_fallback_and_token_refresh() {
        let root = unique_test_dir("codex-fallback");
        let codex_dir = root.join(".codex");
        fs::create_dir_all(&codex_dir).unwrap();

        let auth_path = codex_dir.join("auth.json");
        let work_path = codex_dir.join("auth-work.json");

        // 1. 初始化账号信息（相同的 account_id）
        let initial_auth = "{\"tokens\":{\"account_id\":\"user_123\"}}";
        fs::write(&auth_path, initial_auth).unwrap();
        fs::write(&work_path, initial_auth).unwrap();

        // 2. 在没有 .auth.active 标记文件时加载，应该通过 Fallback 识别出 work 为激活
        let accounts = load_accounts_impl(EditorId::Codex, Some(&root)).unwrap();
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].name, "work");
        assert!(accounts[0].is_active);

        // 此时标记文件应该已被 Fallback 机制自动创建
        let marker_path = codex_dir.join(".auth.active");
        assert!(marker_path.exists());
        let marker_content = fs::read_to_string(&marker_path).unwrap();
        assert!(marker_content.starts_with("work:"));

        // 3. 模拟 Token 刷新，导致内容和文件大小都变了，但 account_id 保持不变
        let refreshed_auth = "{\"tokens\":{\"account_id\":\"user_123\",\"access_token\":\"new_refreshed_token_xyz_longer_content\"}}";
        fs::write(&auth_path, refreshed_auth).unwrap();

        // 4. 加载账号，即使大小和哈希变了，由于 account_id 相同，依然判定为激活
        let accounts = load_accounts_impl(EditorId::Codex, Some(&root)).unwrap();
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].name, "work");
        assert!(accounts[0].is_active);

        // 验证备份文件 auth-work.json 是否也已经被自动同步更新为最新的内容
        let backed_up_content = fs::read_to_string(&work_path).unwrap();
        assert_eq!(backed_up_content, refreshed_auth);

        // 并且标记文件里的大小应该已被自动更新为当前最新大小
        let new_size = fs::metadata(&auth_path).unwrap().len();
        let marker_content = fs::read_to_string(&marker_path).unwrap();
        assert_eq!(marker_content, format!("work:{}", new_size));

        // 5. 模拟用户真正换了账号（登录了新账号，account_id 改变）
        let user2_auth = "{\"tokens\":{\"account_id\":\"user_456\"}}";
        fs::write(&auth_path, user2_auth).unwrap();

        // 6. 加载账号，此时应该不再是 work 激活了
        let accounts = load_accounts_impl(EditorId::Codex, Some(&root)).unwrap();
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].name, "work");
        assert!(!accounts[0].is_active);

        fs::remove_dir_all(root).unwrap();
    }
}

