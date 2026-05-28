use std::path::PathBuf;
use crate::utils::{is_safe_external_url, is_safe_local_path};

#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
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
pub async fn open_local_path(path: String) -> Result<(), String> {
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
pub async fn reveal_local_path(path: String) -> Result<(), String> {
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
pub fn select_directory() -> Result<String, String> {
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
