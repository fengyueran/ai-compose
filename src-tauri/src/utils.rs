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
