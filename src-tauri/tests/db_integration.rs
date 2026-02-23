use diffadvisor_lib::db::Database;

#[test]
fn test_full_workflow() {
    let db = Database::open_in_memory().unwrap();

    // 1. Create a project
    let project = db
        .create_project(
            "E-Commerce API",
            "/home/dev/ecommerce",
            "typescript",
            &["express".into(), "prisma".into()],
            &["security".into(), "nodejs-express".into()],
        )
        .unwrap();
    assert_eq!(project.name, "E-Commerce API");
    assert_eq!(project.frameworks.len(), 2);

    // 2. Create a debrief for the project
    let ai_response = r#"{"architectural_summary": "Adds user auth endpoint"}"#;
    let debrief = db
        .create_debrief(
            project.id,
            "a3f7c2d",
            "feat: add user authentication",
            "diff --git a/src/auth.ts ...",
            Some(ai_response),
            &["security".into()],
        )
        .unwrap();
    assert_eq!(debrief.status, "pending");
    assert_eq!(debrief.commit_hash, "a3f7c2d");

    // 3. Create gaps for the debrief
    let gaps = db
        .create_gaps(
            debrief.id,
            &[
                ("critical", "security", "No rate limiting on login endpoint"),
                ("warning", "security", "Password not hashed with bcrypt"),
                ("info", "maintainability", "Consider extracting auth middleware"),
            ],
        )
        .unwrap();
    assert_eq!(gaps.len(), 3);

    // 4. Create checkpoint responses
    let cp1 = db
        .create_checkpoint_response(
            debrief.id,
            "q1",
            "What happens if an attacker brute-forces the login endpoint?",
            "They could guess passwords because there's no rate limiting",
            "free_text",
        )
        .unwrap();
    let _cp2 = db
        .create_checkpoint_response(
            debrief.id,
            "q2",
            "Why is bcrypt preferred over SHA-256 for passwords?",
            "Bcrypt is designed to be slow, making brute force harder",
            "free_text",
        )
        .unwrap();

    // 5. Update checkpoint evaluation
    let eval = r#"{"score": 9, "feedback": "Excellent understanding of rate limiting importance"}"#;
    db.update_checkpoint_evaluation(cp1.id, eval).unwrap();

    // 6. Mark debrief as reviewed
    db.mark_debrief_reviewed(debrief.id).unwrap();
    let reviewed = db.get_debrief(debrief.id).unwrap();
    assert_eq!(reviewed.status, "reviewed");

    // 7. Resolve a gap
    db.resolve_gap(gaps[0].id).unwrap();
    let unresolved = db.get_unresolved_gaps_by_project(project.id).unwrap();
    assert_eq!(unresolved.len(), 2);

    // 8. Create a knowledge note
    let note = db
        .create_knowledge_note(
            Some(project.id),
            "Rate Limiting",
            "concepts/security",
            "/kb/concepts/security/Rate Limiting.md",
            true,
            "security,rate-limiting,brute-force",
        )
        .unwrap();
    assert_eq!(note.title, "Rate Limiting");
    assert!(note.auto_generated);

    // 9. Save settings
    db.set_setting("ai.model", "gpt-4.1-mini").unwrap();
    let model = db.get_setting("ai.model").unwrap();
    assert_eq!(model, Some("gpt-4.1-mini".to_string()));

    // 10. Verify reads
    let debriefs = db.list_debriefs_by_project(project.id).unwrap();
    assert_eq!(debriefs.len(), 1);

    let all_gaps = db.get_gaps_by_debrief(debrief.id).unwrap();
    assert_eq!(all_gaps.len(), 3);

    let checkpoints = db.get_checkpoint_responses(debrief.id).unwrap();
    assert_eq!(checkpoints.len(), 2);
    assert!(checkpoints[0].ai_evaluation_json.is_some());

    let gap_count = db.count_gaps_by_project(project.id).unwrap();
    assert_eq!(gap_count, 3);

    let notes = db.search_knowledge_notes("rate").unwrap();
    assert_eq!(notes.len(), 1);

    let app_settings = db.get_app_settings().unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&app_settings).unwrap();
    assert_eq!(parsed["ai"]["model"].as_str(), Some("gpt-4.1-mini"));

    // 11. Delete project and verify cascade
    db.delete_project(project.id).unwrap();

    let debriefs_after = db.list_debriefs_by_project(project.id).unwrap();
    assert!(debriefs_after.is_empty());

    let gaps_after = db.get_gaps_by_debrief(debrief.id).unwrap();
    assert!(gaps_after.is_empty());

    let checkpoints_after = db.get_checkpoint_responses(debrief.id).unwrap();
    assert!(checkpoints_after.is_empty());

    // Knowledge note should still exist (ON DELETE SET NULL)
    let note_after = db.get_knowledge_note(note.id).unwrap();
    assert!(note_after.project_id.is_none());
}
