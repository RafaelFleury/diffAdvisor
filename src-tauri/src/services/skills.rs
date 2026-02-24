use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDetect {
    #[serde(default)]
    pub files: Vec<String>,
    #[serde(default)]
    pub content_patterns: Vec<String>,
    #[serde(default)]
    pub extensions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub detect: SkillDetect,
    pub content: String,
    pub built_in: bool,
}

#[derive(Debug, Deserialize)]
struct SkillFrontmatter {
    name: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    detect: Option<SkillDetectYaml>,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct SkillDetectYaml {
    #[serde(default)]
    files: Vec<String>,
    #[serde(default)]
    content_patterns: Vec<String>,
    #[serde(default)]
    extensions: Vec<String>,
}

fn skills_base_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".diffAdvisor")
        .join("skills")
}

pub fn ensure_skills_dir() -> Result<PathBuf, String> {
    let base = skills_base_dir();
    let builtin_dir = base.join("builtin");
    let user_dir = base.join("user");

    fs::create_dir_all(&builtin_dir).map_err(|e| format!("Failed to create builtin skills dir: {}", e))?;
    fs::create_dir_all(&user_dir).map_err(|e| format!("Failed to create user skills dir: {}", e))?;

    // Copy built-in skills if the directory is empty
    let is_empty = fs::read_dir(&builtin_dir)
        .map(|mut d| d.next().is_none())
        .unwrap_or(true);

    if is_empty {
        copy_builtin_skills(&builtin_dir)?;
    }

    Ok(base)
}

fn copy_builtin_skills(dest: &PathBuf) -> Result<(), String> {
    // Look for built-in skills relative to the executable or in the source tree
    let possible_sources = vec![
        // Development: relative to manifest
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("skills"),
    ];

    for source in possible_sources {
        if source.exists() {
            if let Ok(entries) = fs::read_dir(&source) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|e| e.to_str()) == Some("md") {
                        let dest_file = dest.join(entry.file_name());
                        let _ = fs::copy(&path, &dest_file);
                    }
                }
            }
            return Ok(());
        }
    }

    Ok(())
}

pub fn load_all_skills() -> Result<Vec<Skill>, String> {
    let base = ensure_skills_dir()?;
    let mut skills = Vec::new();

    // Load builtin skills
    let builtin_dir = base.join("builtin");
    if builtin_dir.exists() {
        load_skills_from_dir(&builtin_dir, true, &mut skills)?;
    }

    // Load user skills
    let user_dir = base.join("user");
    if user_dir.exists() {
        load_skills_from_dir(&user_dir, false, &mut skills)?;
    }

    Ok(skills)
}

fn load_skills_from_dir(dir: &PathBuf, built_in: bool, skills: &mut Vec<Skill>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read skills dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read skill file {:?}: {}", path, e))?;

        let file_stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown");

        match parse_skill_file(&content, file_stem, built_in) {
            Ok(skill) => skills.push(skill),
            Err(e) => eprintln!("Warning: Failed to parse skill {:?}: {}", path, e),
        }
    }

    Ok(())
}

pub fn parse_skill_file(content: &str, file_stem: &str, built_in: bool) -> Result<Skill, String> {
    // Split on first "---" boundaries to extract YAML frontmatter
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return Err("Missing frontmatter delimiter".to_string());
    }

    let after_first = &trimmed[3..];
    let end_pos = after_first
        .find("\n---")
        .ok_or("Missing closing frontmatter delimiter")?;

    let yaml_str = &after_first[..end_pos];
    let body = after_first[end_pos + 4..].trim().to_string();

    let fm: SkillFrontmatter =
        serde_yaml::from_str(yaml_str).map_err(|e| format!("YAML parse error: {}", e))?;

    let detect = fm.detect.map_or_else(
        || SkillDetect {
            files: vec![],
            content_patterns: vec![],
            extensions: vec![],
        },
        |d| SkillDetect {
            files: d.files,
            content_patterns: d.content_patterns,
            extensions: d.extensions,
        },
    );

    Ok(Skill {
        id: file_stem.to_string(),
        name: fm.name,
        description: fm.description.unwrap_or_default(),
        tags: fm.tags,
        detect,
        content: body,
        built_in,
    })
}

pub fn detect_skills_for_diff(
    skills: &[Skill],
    diff: &str,
    commit_message: &str,
    changed_files: &[String],
) -> Vec<(Skill, u32)> {
    let mut scored: Vec<(Skill, u32)> = Vec::new();

    let combined_text = format!("{}\n{}", diff, commit_message);

    for skill in skills {
        let mut score: u32 = 0;

        // Check file matches
        for detect_file in &skill.detect.files {
            if changed_files.iter().any(|f| f.contains(detect_file.as_str())) {
                score += 1;
            }
        }

        // Check content pattern matches (cap at 3)
        let mut pattern_hits = 0u32;
        for pattern in &skill.detect.content_patterns {
            if combined_text.contains(pattern.as_str()) {
                pattern_hits += 1;
                if pattern_hits >= 3 {
                    break;
                }
            }
        }
        score += pattern_hits;

        // Check extension matches (cap at 3)
        let mut ext_hits = 0u32;
        for ext in &skill.detect.extensions {
            if changed_files.iter().any(|f| f.ends_with(ext.as_str())) {
                ext_hits += 1;
                if ext_hits >= 3 {
                    break;
                }
            }
        }
        score += ext_hits;

        if score >= 1 {
            scored.push((skill.clone(), score));
        }
    }

    scored.sort_by(|a, b| b.1.cmp(&a.1));
    scored
}
