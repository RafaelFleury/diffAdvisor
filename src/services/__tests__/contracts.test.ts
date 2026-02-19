/**
 * Service contract tests.
 *
 * Each `testXxxService` function defines the behavioural contract for a service
 * interface.  The same suite can be run against any implementation by passing a
 * different factory.  To validate the Tauri implementation in Phase 3 just
 * uncomment the additional call at the bottom of each block.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type {
  IProjectService,
  IDebriefService,
  ICheckpointService,
  IKnowledgeService,
  ISettingsService,
} from '../types.ts'
import {
  MockProjectService,
  MockDebriefService,
  MockCheckpointService,
  MockKnowledgeService,
  MockSettingsService,
} from '../mock.ts'

// ─── IProjectService ────────────────────────────────────────────────────────

function testProjectService(factory: () => IProjectService) {
  let service: IProjectService

  beforeEach(() => {
    service = factory()
  })

  it('returns at least one project with required fields', async () => {
    const projects = await service.getProjects()
    expect(projects.length).toBeGreaterThan(0)
    expect(projects[0]).toHaveProperty('id')
    expect(projects[0]).toHaveProperty('name')
    expect(projects[0]).toHaveProperty('path')
  })

  it('returns an active project', async () => {
    const project = await service.getActiveProject()
    expect(project).not.toBeNull()
    expect(project!.id).toBeTruthy()
  })
}

describe('IProjectService — Mock', () => {
  testProjectService(() => new MockProjectService())
})
// Phase 3: describe('IProjectService — Tauri', () => { testProjectService(() => new TauriProjectService()) })

// ─── IDebriefService ─────────────────────────────────────────────────────────

function testDebriefService(factory: () => IDebriefService, knownCommitHash: string) {
  let service: IDebriefService

  beforeEach(() => {
    service = factory()
  })

  it('returns pending commits for a project', async () => {
    const commits = await service.getPendingCommits('proj-1')
    expect(commits.length).toBeGreaterThan(0)
    expect(commits.every((c) => c.status === 'pending')).toBe(true)
  })

  it('returns reviewed commits for a project', async () => {
    const commits = await service.getReviewedCommits('proj-1')
    expect(commits.length).toBeGreaterThan(0)
    expect(commits.every((c) => c.status === 'reviewed')).toBe(true)
  })

  it('returns a debrief for a known commit', async () => {
    const debrief = await service.getDebriefByCommit(knownCommitHash)
    expect(debrief).not.toBeNull()
    expect(debrief!.commitHash).toBe(knownCommitHash)
    expect(debrief!.architecturalSummary).toBeTruthy()
    expect(debrief!.gaps.length).toBeGreaterThan(0)
    expect(debrief!.checkpointQuestions.length).toBeGreaterThan(0)
  })

  it('returns null for an unknown commit hash', async () => {
    const debrief = await service.getDebriefByCommit('__nonexistent__')
    expect(debrief).toBeNull()
  })

  it('returns diff content for a known commit', async () => {
    const diff = await service.getDiffContent(knownCommitHash)
    expect(typeof diff).toBe('string')
    expect(diff.length).toBeGreaterThan(0)
  })

  it('returns a positive gap count', async () => {
    const count = await service.getGapCount('proj-1')
    expect(count).toBeGreaterThan(0)
  })

  it('gaps have valid severity and category values', async () => {
    const debrief = await service.runDebrief(knownCommitHash)
    for (const gap of debrief.gaps) {
      expect(['critical', 'warning', 'info']).toContain(gap.severity)
      expect(['security', 'performance', 'reliability', 'maintainability']).toContain(gap.category)
      expect(gap.description).toBeTruthy()
      expect(gap.suggestion).toBeTruthy()
    }
  })

  it('gap IDs are unique within a debrief', async () => {
    const debrief = await service.runDebrief(knownCommitHash)
    const ids = debrief.gaps.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
}

describe('IDebriefService — Mock', () => {
  testDebriefService(() => new MockDebriefService(), 'a3f7c2d')
})
// Phase 3: describe('IDebriefService — Tauri', () => { testDebriefService(() => new TauriDebriefService(), '<real-hash>') })

// ─── ICheckpointService ──────────────────────────────────────────────────────

function testCheckpointService(factory: () => ICheckpointService) {
  let service: ICheckpointService

  beforeEach(() => {
    service = factory()
  })

  it('returns an evaluation with required fields on submit', async () => {
    const evaluation = await service.submitCheckpoint('debrief-1', 'q-1', 'Test answer')
    expect(evaluation).toHaveProperty('score')
    expect(evaluation).toHaveProperty('feedback')
    expect(evaluation.score).toBeGreaterThanOrEqual(0)
    expect(evaluation.score).toBeLessThanOrEqual(10)
    expect(evaluation.keyPointsCovered).toBeInstanceOf(Array)
    expect(evaluation.keyPointsMissed).toBeInstanceOf(Array)
  })

  it('persists submitted responses and they are retrievable', async () => {
    const uniqueAnswer = `answer-${Date.now()}`
    await service.submitCheckpoint('debrief-1', 'q-1', uniqueAnswer)
    const responses = await service.getResponses('debrief-1')
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[responses.length - 1].responseText).toBe(uniqueAnswer)
  })
}

describe('ICheckpointService — Mock', () => {
  testCheckpointService(() => new MockCheckpointService())
})
// Phase 3: describe('ICheckpointService — Tauri', () => { testCheckpointService(() => new TauriCheckpointService()) })

// ─── IKnowledgeService ───────────────────────────────────────────────────────

function testKnowledgeService(factory: () => IKnowledgeService, knownNoteId: string, knownNoteTitle: string) {
  let service: IKnowledgeService

  beforeEach(() => {
    service = factory()
  })

  it('returns at least one note with required fields', async () => {
    const notes = await service.getNotes()
    expect(notes.length).toBeGreaterThan(0)
    expect(notes[0]).toHaveProperty('id')
    expect(notes[0]).toHaveProperty('title')
    expect(notes[0]).toHaveProperty('content')
  })

  it('returns a specific note by ID', async () => {
    const note = await service.getNote(knownNoteId)
    expect(note).not.toBeNull()
    expect(note!.title).toBe(knownNoteTitle)
  })

  it('returns null for an unknown note ID', async () => {
    const note = await service.getNote('__nonexistent__')
    expect(note).toBeNull()
  })

  it('returns results when searching by keyword', async () => {
    const results = await service.searchNotes('security')
    expect(results.length).toBeGreaterThan(0)
  })

  it('returns all notes for an empty search query', async () => {
    const all = await service.getNotes()
    const results = await service.searchNotes('')
    expect(results.length).toBe(all.length)
  })

  it('saves a new note and increases the note count', async () => {
    const before = await service.getNotes()
    await service.saveNote({
      title: 'Contract Test Note',
      content: '# Contract\nThis note was saved by a contract test.',
      categoryPath: 'test/contracts',
    })
    const after = await service.getNotes()
    expect(after.length).toBe(before.length + 1)
  })
}

describe('IKnowledgeService — Mock', () => {
  testKnowledgeService(() => new MockKnowledgeService(), 'note-1', 'JWT Authentication')
})
// Phase 3: describe('IKnowledgeService — Tauri', () => { testKnowledgeService(() => new TauriKnowledgeService(), '<real-id>', '<real-title>') })

// ─── ISettingsService ────────────────────────────────────────────────────────

function testSettingsService(factory: () => ISettingsService) {
  let service: ISettingsService

  beforeEach(() => {
    service = factory()
  })

  it('returns settings with all required top-level keys', async () => {
    const settings = await service.getSettings()
    expect(settings).toHaveProperty('project')
    expect(settings).toHaveProperty('ai')
    expect(settings).toHaveProperty('analysis')
    expect(settings).toHaveProperty('knowledge')
    expect(settings).toHaveProperty('appearance')
  })

  it('applies partial updates and reflects them on next read', async () => {
    await service.updateSettings({
      analysis: { autoAnalyze: true, checkpointMode: 'free_text', analysisDepth: 'deep' },
    })
    const updated = await service.getSettings()
    expect(updated.analysis.autoAnalyze).toBe(true)
    expect(updated.analysis.analysisDepth).toBe('deep')
  })

  it('returns skills with required fields', async () => {
    const skills = await service.getSkills()
    expect(skills.length).toBeGreaterThan(0)
    expect(skills[0]).toHaveProperty('id')
    expect(skills[0]).toHaveProperty('name')
    expect(skills[0]).toHaveProperty('enabled')
  })

  it('toggles a skill and the change persists', async () => {
    const before = await service.getSkills()
    const target = before.find((s) => s.enabled)!
    await service.toggleSkill(target.id, false)
    const after = await service.getSkills()
    const updated = after.find((s) => s.id === target.id)!
    expect(updated.enabled).toBe(false)
  })

  it('testConnection returns success and message fields', async () => {
    const result = await service.testConnection()
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('message')
  })
}

describe('ISettingsService — Mock', () => {
  testSettingsService(() => new MockSettingsService())
})
// Phase 3: describe('ISettingsService — Tauri', () => { testSettingsService(() => new TauriSettingsService()) })
