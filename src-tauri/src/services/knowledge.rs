use std::fs;
use std::path::{Path, PathBuf};
use serde::Deserialize;

pub struct NoteFrontmatter {
    pub title: String,
    pub tags: Vec<String>,
    pub category: String,
    pub source_project: String,
    pub source_commit: String,
    pub auto_generated: bool,
    pub created: String,
    pub updated: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct ParsedFrontmatter {
    pub title: Option<String>,
    pub tags: Option<Vec<String>>,
    pub category: Option<String>,
    pub auto_generated: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct IndexedNote {
    pub title: String,
    pub category_path: String,
    pub file_path: PathBuf,
    pub tags: Vec<String>,
    pub auto_generated: bool,
}

pub fn sanitize_filename(title: &str) -> String {
    let sanitized: String = title
        .chars()
        .filter(|c| !"/\\:*?\"<>|".contains(*c))
        .collect();

    // Collapse multiple spaces
    let mut result = String::new();
    let mut prev_space = false;
    for ch in sanitized.chars() {
        if ch == ' ' {
            if !prev_space {
                result.push(ch);
                prev_space = true;
            }
        } else {
            result.push(ch);
            prev_space = false;
        }
    }

    let result = result.trim().to_string();
    if result.len() > 200 {
        result[..200].to_string()
    } else {
        result
    }
}

pub fn ensure_kb_dir(kb_path: &Path, category: &str) -> Result<PathBuf, String> {
    let dir = kb_path.join(category);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create KB directory {:?}: {}", dir, e))?;
    Ok(dir)
}

pub fn write_note_atomic(path: &Path, frontmatter: &NoteFrontmatter, content: &str) -> Result<(), String> {
    let fm_yaml = build_frontmatter_yaml(frontmatter);
    let full_content = format!("{}\n{}", fm_yaml, content);

    // Backup existing file
    if path.exists() {
        let bak_path = path.with_extension("md.bak");
        let _ = fs::copy(path, &bak_path);
    }

    // Write to temp file then rename
    let tmp_path = path.with_extension("md.tmp");
    fs::write(&tmp_path, &full_content)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    fs::rename(&tmp_path, path)
        .map_err(|e| format!("Failed to rename temp file: {}", e))?;

    Ok(())
}

pub fn read_note(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Failed to read note {:?}: {}", path, e))
}

pub fn strip_yaml_frontmatter(content: &str) -> String {
    let mut lines = content.lines();
    match lines.next() {
        Some(first) if first.trim() == "---" => {}
        _ => return content.to_string(),
    }

    let mut in_body = false;
    let mut body_lines = Vec::new();
    for line in lines {
        if !in_body && line.trim() == "---" {
            in_body = true;
            continue;
        }
        if in_body {
            body_lines.push(line);
        }
    }

    if in_body {
        body_lines.join("\n").trim_start_matches('\n').to_string()
    } else {
        content.to_string()
    }
}

pub fn list_existing_note_titles(kb_path: &Path) -> Vec<(String, String)> {
    let mut titles = Vec::new();
    walk_kb_dir(kb_path, kb_path, &mut titles);
    titles
}

pub fn scan_kb_notes(kb_path: &Path) -> Vec<IndexedNote> {
    let mut notes = Vec::new();
    walk_kb_note_files(kb_path, kb_path, &mut notes);
    notes.sort_by(|a, b| a.file_path.cmp(&b.file_path));
    notes
}

fn walk_kb_dir(base: &Path, dir: &Path, titles: &mut Vec<(String, String)>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_kb_dir(base, &path, titles);
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let title = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            let category = path
                .parent()
                .and_then(|p| p.strip_prefix(base).ok())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            titles.push((title, category));
        }
    }
}

fn walk_kb_note_files(base: &Path, dir: &Path, notes: &mut Vec<IndexedNote>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_kb_note_files(base, &path, notes);
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            notes.push(index_note_file(base, &path));
        }
    }
}

pub fn find_existing_note(kb_path: &Path, title: &str) -> Option<PathBuf> {
    let sanitized = sanitize_filename(title);
    find_note_recursive(kb_path, &sanitized)
}

pub fn is_note_path_in_root(path: &Path, kb_root: &Path) -> bool {
    normalize_path(path).starts_with(normalize_path(kb_root))
}

fn index_note_file(base: &Path, path: &Path) -> IndexedNote {
    let raw = fs::read_to_string(path).unwrap_or_default();
    let frontmatter = parse_frontmatter(&raw).unwrap_or_default();
    let title = frontmatter
        .title
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string()
        });
    let category_path = frontmatter
        .category
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            path.parent()
                .and_then(|p| p.strip_prefix(base).ok())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default()
        });

    IndexedNote {
        title,
        category_path,
        file_path: path.to_path_buf(),
        tags: frontmatter.tags.unwrap_or_default(),
        auto_generated: frontmatter.auto_generated.unwrap_or(false),
    }
}

fn parse_frontmatter(content: &str) -> Option<ParsedFrontmatter> {
    let mut lines = content.lines();
    match lines.next() {
        Some(first) if first.trim() == "---" => {}
        _ => return None,
    }

    let mut yaml_lines = Vec::new();
    for line in lines {
        if line.trim() == "---" {
            let yaml = yaml_lines.join("\n");
            return serde_yaml::from_str::<ParsedFrontmatter>(&yaml).ok();
        }
        yaml_lines.push(line);
    }

    None
}

fn normalize_path(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| {
        if path.is_absolute() {
            path.to_path_buf()
        } else {
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(path)
        }
    })
}

fn find_note_recursive(dir: &Path, sanitized_title: &str) -> Option<PathBuf> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return None,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_note_recursive(&path, sanitized_title) {
                return Some(found);
            }
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            if stem == sanitized_title {
                return Some(path);
            }
        }
    }

    None
}

pub fn build_frontmatter_yaml(fm: &NoteFrontmatter) -> String {
    let tags_str = if fm.tags.is_empty() {
        "[]".to_string()
    } else {
        format!("[{}]", fm.tags.join(", "))
    };

    let mut yaml = format!(
        "---\ntitle: {}\ntags: {}\ncategory: {}\nsource_project: {}\nsource_commit: {}\nauto_generated: {}\ncreated: {}",
        fm.title, tags_str, fm.category, fm.source_project, fm.source_commit, fm.auto_generated, fm.created
    );

    if let Some(ref updated) = fm.updated {
        yaml.push_str(&format!("\nupdated: {}", updated));
    }

    yaml.push_str("\n---\n");
    yaml
}

pub fn expand_kb_path(path_str: &str) -> PathBuf {
    if path_str.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path_str[2..]);
        }
    }
    PathBuf::from(path_str)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_kb_notes_reads_frontmatter() {
        let temp = tempfile::tempdir().unwrap();
        let category_dir = temp.path().join("concepts/security");
        fs::create_dir_all(&category_dir).unwrap();
        let note_path = category_dir.join("JWT Authentication.md");
        fs::write(
            &note_path,
            concat!(
                "---\n",
                "title: JWT Authentication\n",
                "tags: [security, authentication]\n",
                "category: concepts/security\n",
                "auto_generated: true\n",
                "---\n",
                "# JWT Authentication\n"
            ),
        )
        .unwrap();

        let notes = scan_kb_notes(temp.path());

        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].title, "JWT Authentication");
        assert_eq!(notes[0].category_path, "concepts/security");
        assert_eq!(notes[0].tags, vec!["security", "authentication"]);
        assert!(notes[0].auto_generated);
    }

    #[test]
    fn test_is_note_path_in_root_rejects_outside_files() {
        let temp = tempfile::tempdir().unwrap();
        let kb_root = temp.path().join("kb");
        let outside_root = temp.path().join("outside");
        fs::create_dir_all(&kb_root).unwrap();
        fs::create_dir_all(&outside_root).unwrap();

        let inside = kb_root.join("note.md");
        let outside = outside_root.join("note.md");
        fs::write(&inside, "# inside").unwrap();
        fs::write(&outside, "# outside").unwrap();

        assert!(is_note_path_in_root(&inside, &kb_root));
        assert!(!is_note_path_in_root(&outside, &kb_root));
    }
}
