use std::path::PathBuf;

pub const MANAGED_BLOCK_START: &str = "<!-- BEGIN AI-COMPOSE -->";
pub const MANAGED_BLOCK_END: &str = "<!-- END AI-COMPOSE -->";

#[derive(serde::Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ApplyAction {
    Removed,
    Unchanged,
    Updated,
}

pub fn toml_to_json(toml: &toml::Value) -> serde_json::Value {
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

pub fn json_to_toml(json: &serde_json::Value) -> toml::Value {
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

pub fn get_home_dir() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .map_err(|_| "无法读取当前用户的 HOME 目录。".to_string())
}

pub fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_secs().to_string(),
        Err(_) => "0".to_string(),
    }
}

pub fn normalize_trailing_newline(value: &str) -> String {
    if value.ends_with('\n') {
        value.to_string()
    } else {
        format!("{value}\n")
    }
}

pub fn npx_command_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "npx.cmd"
    } else {
        "npx"
    }
}

pub fn get_extra_path_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Ok(home_path) = get_home_dir() {
        let nvm_node_dir = home_path.join(".nvm").join("versions").join("node");
        if nvm_node_dir.exists() && nvm_node_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&nvm_node_dir) {
                let mut version_dirs = Vec::new();
                for entry in entries.filter_map(Result::ok) {
                    let bin_dir = entry.path().join("bin");
                    if bin_dir.exists() && bin_dir.is_dir() {
                        version_dirs.push(bin_dir);
                    }
                }
                version_dirs.sort_by(|a, b| b.cmp(a));
                dirs.extend(version_dirs);
            }
        }

        let fnm_multishells_dir = home_path.join(".fnm").join("multishells");
        if fnm_multishells_dir.exists() && fnm_multishells_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&fnm_multishells_dir) {
                for entry in entries.filter_map(Result::ok) {
                    let bin_dir = entry.path().join("bin");
                    if bin_dir.exists() && bin_dir.is_dir() {
                        dirs.push(bin_dir);
                    }
                }
            }
        }

        dirs.push(home_path.join(".fnm").join("current").join("bin"));
        dirs.push(home_path.join(".volta").join("bin"));
        dirs.push(home_path.join(".asdf").join("shims"));
        dirs.push(home_path.join(".bun").join("bin"));
        dirs.push(home_path.join(".pnpm"));
        dirs.push(home_path.join(".local").join("share").join("pnpm"));
        dirs.push(home_path.join(".cargo").join("bin"));
        dirs.push(home_path.join(".local").join("bin"));

        dirs.push(home_path.join("AppData").join("Roaming").join("npm"));
        dirs.push(home_path.join("AppData").join("Local").join("Programs").join("node"));
    }

    dirs.push(PathBuf::from("/opt/homebrew/bin"));
    dirs.push(PathBuf::from("/opt/homebrew/sbin"));
    dirs.push(PathBuf::from("/usr/local/bin"));
    dirs.push(PathBuf::from("/usr/local/sbin"));
    dirs.push(PathBuf::from("/home/linuxbrew/.linuxbrew/bin"));
    dirs.push(PathBuf::from("/usr/bin"));
    dirs.push(PathBuf::from("/bin"));
    dirs.push(PathBuf::from("/usr/sbin"));
    dirs.push(PathBuf::from("/sbin"));
    dirs.push(PathBuf::from(r"C:\Program Files\nodejs"));
    dirs.push(PathBuf::from(r"C:\Program Files (x86)\nodejs"));

    dirs.into_iter().filter(|d| d.exists() && d.is_dir()).collect()
}

pub fn get_augmented_path() -> String {
    let system_path = std::env::var("PATH").unwrap_or_default();
    let current_parts: Vec<PathBuf> = std::env::split_paths(&system_path).collect();

    let extra_dirs = get_extra_path_dirs();
    let mut all_paths = Vec::new();

    for dir in extra_dirs {
        if !all_paths.contains(&dir) {
            all_paths.push(dir);
        }
    }

    for dir in current_parts {
        if !all_paths.contains(&dir) {
            all_paths.push(dir);
        }
    }

    match std::env::join_paths(all_paths) {
        Ok(os_str) => os_str.to_string_lossy().to_string(),
        Err(_) => system_path,
    }
}

pub fn resolve_executable_path(bin_name: &str) -> PathBuf {
    let augmented_path = get_augmented_path();
    let paths = std::env::split_paths(&augmented_path);

    let candidates = if cfg!(target_os = "windows") {
        if bin_name.ends_with(".cmd") || bin_name.ends_with(".exe") || bin_name.ends_with(".bat") {
            vec![bin_name.to_string()]
        } else {
            vec![
                format!("{}.cmd", bin_name),
                format!("{}.exe", bin_name),
                format!("{}.bat", bin_name),
                bin_name.to_string(),
            ]
        }
    } else {
        vec![bin_name.to_string()]
    };

    for path_dir in paths {
        for candidate in &candidates {
            let full_path = path_dir.join(candidate);
            if full_path.is_file() {
                return full_path;
            }
        }
    }

    PathBuf::from(npx_command_name())
}

pub fn create_async_npx_command() -> tokio::process::Command {
    let npx_path = resolve_executable_path("npx");
    let augmented_path = get_augmented_path();
    let mut cmd = tokio::process::Command::new(npx_path);
    cmd.env("PATH", augmented_path);
    cmd
}


pub fn is_safe_repo_source(repo: &str) -> bool {
    let parts = repo.split('/').collect::<Vec<_>>();
    parts.len() >= 2
        && parts
            .iter()
            .all(|segment| !segment.is_empty() && segment.chars().all(is_safe_cli_identifier_char))
}

pub fn is_safe_external_url(url: &str) -> bool {
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

pub fn is_safe_local_path(path: &str) -> bool {
    let trimmed = path.trim();
    !trimmed.is_empty()
        && !trimmed.contains('\n')
        && !trimmed.contains('\r')
        && !trimmed.contains('\0')
}

pub fn normalize_repo_source(repo: &str) -> Option<String> {
    let trimmed = repo.trim().trim_end_matches('/');
    let without_scheme = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(trimmed);
    let without_www = without_scheme
        .strip_prefix("www.")
        .unwrap_or(without_scheme);
    let github_path = if let Some(path) = without_www.strip_prefix("github.com/") {
        path
    } else if is_safe_repo_source(trimmed) {
        return Some(trimmed.to_string());
    } else {
        return None;
    };
    let github_path = github_path.split(['?', '#']).next().unwrap_or(github_path);
    let path_without_suffix = github_path.trim_end_matches('/');
    let path_without_suffix = path_without_suffix
        .strip_suffix(".git")
        .unwrap_or(path_without_suffix)
        .trim_end_matches('/');

    let parts = path_without_suffix
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();
    if parts.len() < 2 {
        return None;
    }

    let normalized = if parts.len() >= 4 && parts[2] == "tree" {
        if parts.len() == 4 {
            format!("{}/{}", parts[0], parts[1])
        } else {
            let subpath = parts[4..].join("/");
            format!("{}/{}/{}", parts[0], parts[1], subpath)
        }
    } else {
        parts.join("/")
    };

    is_safe_repo_source(&normalized).then_some(normalized)
}

pub fn is_safe_skill_id(skill_id: &str) -> bool {
    !skill_id.is_empty()
        && !skill_id.contains('/')
        && !skill_id.contains('\\')
        && skill_id.chars().all(is_safe_cli_identifier_char)
}

pub fn is_safe_cli_identifier_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.')
}

pub fn parse_scutil_proxy_output(stdout: &str) -> Option<String> {
    let mut https_enabled = false;
    let mut https_proxy = None;
    let mut https_port = None;

    let mut http_enabled = false;
    let mut http_proxy = None;
    let mut http_port = None;

    for line in stdout.lines() {
        let line = line.trim();
        if line.starts_with("HTTPSEnable :") {
            if line.contains('1') {
                https_enabled = true;
            }
        } else if line.starts_with("HTTPSProxy :") {
            if let Some(val) = line.split(':').nth(1) {
                https_proxy = Some(val.trim().to_string());
            }
        } else if line.starts_with("HTTPSPort :") {
            if let Some(val) = line.split(':').nth(1) {
                https_port = Some(val.trim().to_string());
            }
        } else if line.starts_with("HTTPEnable :") {
            if line.contains('1') {
                http_enabled = true;
            }
        } else if line.starts_with("HTTPProxy :") {
            if let Some(val) = line.split(':').nth(1) {
                http_proxy = Some(val.trim().to_string());
            }
        } else if line.starts_with("HTTPPort :") {
            if let Some(val) = line.split(':').nth(1) {
                http_port = Some(val.trim().to_string());
            }
        }
    }

    if https_enabled {
        if let (Some(proxy), Some(port)) = (https_proxy, https_port) {
            return Some(format!("http://{}:{}", proxy, port));
        }
    }
    if http_enabled {
        if let (Some(proxy), Some(port)) = (http_proxy, http_port) {
            return Some(format!("http://{}:{}", proxy, port));
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn get_mac_system_proxy() -> Option<String> {
    use std::process::Command;
    let output = Command::new("scutil").arg("--proxy").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_scutil_proxy_output(&stdout)
}

pub fn get_proxy_url() -> Option<String> {
    if let Ok(proxy) = std::env::var("HTTPS_PROXY") {
        return Some(proxy);
    }
    if let Ok(proxy) = std::env::var("https_proxy") {
        return Some(proxy);
    }
    if let Ok(proxy) = std::env::var("HTTP_PROXY") {
        return Some(proxy);
    }
    if let Ok(proxy) = std::env::var("http_proxy") {
        return Some(proxy);
    }
    if let Ok(proxy) = std::env::var("ALL_PROXY") {
        return Some(proxy);
    }
    if let Ok(proxy) = std::env::var("all_proxy") {
        return Some(proxy);
    }

    #[cfg(target_os = "macos")]
    {
        get_mac_system_proxy()
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

pub fn create_client() -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder();
    if let Some(proxy_url) = get_proxy_url() {
        if let Ok(proxy) = reqwest::Proxy::all(&proxy_url) {
            builder = builder.proxy(proxy);
        }
    }
    builder.build().map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_augmented_path_includes_system_and_extra_dirs() {
        let path = get_augmented_path();
        assert!(!path.is_empty());
    }

    #[test]
    fn resolve_executable_path_returns_valid_path_or_fallback() {
        let npx_path = resolve_executable_path("npx");
        assert!(!npx_path.as_os_str().is_empty());
    }
}


