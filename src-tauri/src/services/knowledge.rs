use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
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
    /// Note body without frontmatter.
    pub content: String,
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
        result[..result.floor_char_boundary(200)].trim_end().to_string()
    } else {
        result
    }
}

/// Turns a category (often LLM-provided) into a relative path that stays
/// inside the KB root: no `..`, no absolute paths, no drive prefixes.
pub fn sanitize_category(category: &str) -> String {
    category
        .split(['/', '\\'])
        .map(|part| sanitize_filename(part).trim().trim_matches('.').trim().to_string())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("/")
}

pub fn ensure_kb_dir(kb_path: &Path, category: &str) -> Result<PathBuf, String> {
    let dir = kb_path.join(sanitize_category(category));
    if !dir.starts_with(kb_path) {
        return Err(format!("Refusing to write outside the knowledge base: {:?}", dir));
    }
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
    list_note_files(kb_path)
        .into_iter()
        .map(|(path, _)| index_note_file(kb_path, &path))
        .collect()
}

/// All `.md` files under the KB with their modification time (seconds),
/// without reading them, so unchanged files can skip re-indexing.
pub fn list_note_files(kb_path: &Path) -> Vec<(PathBuf, i64)> {
    let mut files = Vec::new();
    walk_kb_note_files(kb_path, &mut files);
    files.sort();
    files
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

fn walk_kb_note_files(dir: &Path, files: &mut Vec<(PathBuf, i64)>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_kb_note_files(&path, files);
        } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let modified = entry
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            files.push((path, modified));
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

pub fn index_note_file(base: &Path, path: &Path) -> IndexedNote {
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
        content: strip_yaml_frontmatter(&raw),
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

const STOPWORDS: &[&str] = &[
    "this", "that", "with", "from", "have", "will", "your", "into", "than", "then", "them", "when",
    "what", "which", "there", "their", "about", "would", "should", "could", "these", "those",
    "const", "function", "return", "require", "import", "export", "default", "async", "await",
    "true", "false", "null", "undefined", "none", "self", "string", "number", "boolean", "void",
    "class", "public", "private", "static", "struct", "impl", "let", "mut", "else", "while",
    "module", "exports", "type", "interface", "value", "data", "result", "error", "index", "file",
    "diff", "git", "new", "mode", "dev", "main", "test", "tests",
];

/// Most frequent meaningful words in `text` (identifiers are split on
/// camelCase and snake_case), for building a knowledge base search.
pub fn extract_search_terms(text: &str, max_terms: usize) -> Vec<String> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    let mut order: Vec<String> = Vec::new();

    for token in text.split(|c: char| !c.is_alphanumeric()) {
        let mut word = String::new();
        let mut prev_lower = false;
        let mut words = Vec::new();
        for ch in token.chars() {
            if ch.is_uppercase() && prev_lower {
                words.push(std::mem::take(&mut word));
            }
            prev_lower = ch.is_lowercase();
            word.extend(ch.to_lowercase());
        }
        words.push(word);

        for word in words {
            if word.chars().count() < 4
                || word.chars().all(|c| c.is_ascii_digit())
                || STOPWORDS.contains(&word.as_str())
            {
                continue;
            }
            let count = counts.entry(word.clone()).or_insert(0);
            if *count == 0 {
                order.push(word);
            }
            *count += 1;
        }
    }

    // Stable: ties keep first-seen order.
    order.sort_by(|a, b| counts[b].cmp(&counts[a]));
    order.truncate(max_terms);
    order
}

fn quote_fts_term(term: &str) -> String {
    format!("\"{}\"", term.replace('"', ""))
}

/// FTS5 query matching notes that contain any of `terms`.
pub fn fts_any_terms_query(terms: &[String]) -> Option<String> {
    let quoted: Vec<String> = terms
        .iter()
        .filter(|t| !t.trim().is_empty())
        .map(|t| quote_fts_term(t))
        .collect();
    (!quoted.is_empty()).then(|| quoted.join(" OR "))
}

/// FTS5 query for what a user typed: every word must match, as a prefix,
/// so results narrow while typing.
pub fn fts_user_query(input: &str) -> Option<String> {
    let words: Vec<String> = input
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(|w| format!("{}*", quote_fts_term(w)))
        .collect();
    (!words.is_empty()).then(|| words.join(" "))
}

/// Which items to send in full, in order, so their total size stays within
/// `budget`. Items that don't fit are skipped, but smaller ones after them
/// can still be included.
pub fn select_within_budget(sizes: &[usize], budget: usize) -> Vec<bool> {
    let mut remaining = budget;
    sizes
        .iter()
        .map(|&size| {
            let fits = size <= remaining;
            if fits {
                remaining -= size;
            }
            fits
        })
        .collect()
}

pub struct RelatedNote {
    pub title: String,
    pub category_path: String,
    pub file_path: String,
    pub excerpt: String,
}

/// Prompt section listing notes found by keyword search, so the model starts
/// from the developer's existing knowledge instead of searching blindly.
pub fn format_related_notes(notes: &[RelatedNote]) -> String {
    if notes.is_empty() {
        return String::new();
    }
    let blocks: Vec<String> = notes
        .iter()
        .map(|note| {
            format!(
                "### {} ({})\nFile: `{}`\n{}\n",
                note.title,
                if note.category_path.is_empty() { "uncategorized" } else { &note.category_path },
                note.file_path,
                note.excerpt
            )
        })
        .collect();
    format!(
        "## Possibly Related Notes\n\
These notes from the developer's knowledge base matched keywords of this task (excerpts; read the full file if you need more). \
Link them by exact title where relevant and don't repeat what they already explain.\n\n{}",
        blocks.join("\n")
    )
}

/// Builds the `title :: category` catalog of existing notes for a note-writing
/// prompt, capped at `budget_chars`. Notes in the target category come first,
/// then notes sharing its top-level folder, then the rest, so the entries most
/// likely to be linked survive the cap. Returns the lines and how many notes
/// were left out.
pub fn select_note_catalog(
    notes: &[(String, String)],
    target_category: &str,
    budget_chars: usize,
) -> (Vec<String>, usize) {
    let top_level = |category: &str| category.split('/').next().unwrap_or_default().to_string();
    let target_top = top_level(target_category);
    let rank = |category: &str| {
        if category == target_category {
            0
        } else if !target_top.is_empty() && top_level(category) == target_top {
            1
        } else {
            2
        }
    };

    let mut sorted: Vec<&(String, String)> = notes.iter().collect();
    sorted.sort_by(|a, b| (rank(&a.1), &a.1, &a.0).cmp(&(rank(&b.1), &b.1, &b.0)));

    let mut lines = Vec::new();
    let mut used = 0;
    for (title, category) in &sorted {
        let line = if category.is_empty() {
            title.clone()
        } else {
            format!("{} :: {}", title, category)
        };
        let cost = line.chars().count() + 1;
        if used + cost > budget_chars {
            break;
        }
        used += cost;
        lines.push(line);
    }
    let omitted = sorted.len() - lines.len();
    (lines, omitted)
}

/// The note's headings, one per line, so a model can see everything a long
/// note covers without reading all of it.
pub fn note_outline(content: &str) -> String {
    let mut in_code_fence = false;
    content
        .lines()
        .filter(|line| {
            if line.trim_start().starts_with("```") {
                in_code_fence = !in_code_fence;
                return false;
            }
            !in_code_fence && line.starts_with('#')
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Appends newly written sections to an existing note body, dropping the H1
/// the model may have added (the note already has its own).
pub fn append_note_sections(existing: &str, new_sections: &str) -> String {
    let new_sections = new_sections.trim();
    let new_sections = match new_sections.lines().next() {
        Some(first) if first.starts_with("# ") => new_sections[first.len()..].trim_start(),
        _ => new_sections,
    };
    if new_sections.is_empty() {
        return existing.to_string();
    }
    format!("{}\n\n{}\n", existing.trim_end(), new_sections)
}

/// First `max_chars` characters of a note body, cut at a line break when possible.
pub fn note_excerpt(content: &str, max_chars: usize) -> String {
    let content = content.trim();
    if content.chars().count() <= max_chars {
        return content.to_string();
    }
    let cut: String = content.chars().take(max_chars).collect();
    let cut = match cut.rfind('\n') {
        Some(pos) if pos > max_chars / 2 => cut[..pos].to_string(),
        _ => cut,
    };
    format!("{}\n[...]", cut.trim_end())
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
    fn test_select_note_catalog_prefers_same_category_and_respects_budget() {
        let notes = vec![
            ("Zeta".to_string(), "backend/db".to_string()),
            ("Alpha".to_string(), "frontend/react".to_string()),
            ("Beta".to_string(), "algorithms/graphics".to_string()),
            ("Gamma".to_string(), "algorithms/sorting".to_string()),
            ("Loose".to_string(), String::new()),
        ];

        let (all, omitted) = select_note_catalog(&notes, "algorithms/graphics", 10_000);
        assert_eq!(omitted, 0);
        assert_eq!(all[0], "Beta :: algorithms/graphics");
        assert_eq!(all[1], "Gamma :: algorithms/sorting");
        assert!(all.contains(&"Loose".to_string()));

        // Room for exactly the two highest-ranked lines (each line costs its length + 1).
        let budget = "Beta :: algorithms/graphics".len() + "Gamma :: algorithms/sorting".len() + 2;
        let (capped, omitted) = select_note_catalog(&notes, "algorithms/graphics", budget);
        assert_eq!(capped, ["Beta :: algorithms/graphics", "Gamma :: algorithms/sorting"]);
        assert_eq!(omitted, 3);
    }

    #[test]
    fn test_append_note_sections_drops_generated_h1() {
        let merged = append_note_sections("# Note\n\nOld text.\n\n", "# Note\n\n## New Part\nNew text.");
        assert_eq!(merged, "# Note\n\nOld text.\n\n## New Part\nNew text.\n");
        assert_eq!(append_note_sections("# Note\nOld.", "# Note\n"), "# Note\nOld.");
    }

    #[test]
    fn test_note_outline_lists_headings_outside_code() {
        let outline = note_outline("# Title\ntext\n## Part A\n```bash\n# not a heading\n```\n### Detail\n");
        assert_eq!(outline, "# Title\n## Part A\n### Detail");
    }

    #[test]
    fn test_extract_search_terms_splits_identifiers_and_drops_noise() {
        let terms = extract_search_terms(
            "+const rateLimiter = require('./middleware')\n+router.post('/signup', rateLimiter, hashPassword)\nadd signup route",
            5,
        );
        assert_eq!(terms[..2], ["rate".to_string(), "limiter".to_string()]);
        assert!(terms.contains(&"signup".to_string()));
        assert!(!terms.iter().any(|t| t == "const" || t == "require"));
    }

    #[test]
    fn test_fts_queries_quote_terms() {
        assert_eq!(
            fts_any_terms_query(&["rate".into(), "lim\"iter".into()]).as_deref(),
            Some("\"rate\" OR \"limiter\"")
        );
        assert_eq!(fts_user_query("rate lim").as_deref(), Some("\"rate\"* \"lim\"*"));
        assert_eq!(fts_user_query("  ").as_deref(), None);
    }

    #[test]
    fn test_select_within_budget_skips_what_does_not_fit() {
        assert_eq!(select_within_budget(&[40, 50, 20, 5], 70), [true, false, true, true]);
        assert_eq!(select_within_budget(&[0, 10], 0), [true, false]);
        assert!(select_within_budget(&[], 10).is_empty());
    }

    #[test]
    fn test_note_excerpt_cuts_long_notes() {
        let excerpt = note_excerpt(&format!("{}\nsecond line", "a".repeat(30)), 35);
        assert_eq!(excerpt, format!("{}\n[...]", "a".repeat(30)));
        assert_eq!(note_excerpt("short", 35), "short");
    }

    #[test]
    fn test_sanitize_category_stays_inside_root() {
        assert_eq!(sanitize_category("security/rate-limiting"), "security/rate-limiting");
        assert_eq!(sanitize_category("../../.config/autostart"), "config/autostart");
        assert_eq!(sanitize_category("/etc/cron.d"), "etc/cron.d");
        assert_eq!(sanitize_category("C:\\Windows\\..\\x"), "C/Windows/x");
        assert_eq!(sanitize_category(" . / .. "), "");
    }

    #[test]
    fn test_ensure_kb_dir_never_escapes_root() {
        let temp = tempfile::tempdir().unwrap();
        let dir = ensure_kb_dir(temp.path(), "../../outside").unwrap();
        assert_eq!(dir, temp.path().join("outside"));
        assert!(dir.exists());
    }

    #[test]
    fn test_sanitize_filename_truncates_on_char_boundary() {
        let title = format!("a{}", "ção ".repeat(80));
        let result = sanitize_filename(&title);
        assert!(result.len() <= 200);
    }

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
