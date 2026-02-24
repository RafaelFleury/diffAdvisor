import { invoke } from '@tauri-apps/api/core'
import type {
  Project,
  Commit,
  DebriefResult,
  FileDiff,
  CheckpointResponse,
  Evaluation,
  KnowledgeNote,
  Skill,
  AppSettings,
} from '@/types/index.ts'
import type {
  IProjectService,
  IDebriefService,
  ICheckpointService,
  IKnowledgeService,
  ISettingsService,
} from './types.ts'

export class TauriProjectService implements IProjectService {
  getProjects(): Promise<Project[]> {
    return invoke<Project[]>('list_projects')
  }

  getActiveProject(): Promise<Project | null> {
    return invoke<Project | null>('get_active_project')
  }

  setActiveProject(projectId: string): Promise<void> {
    return invoke('set_active_project', { projectId: parseInt(projectId) })
  }

  addProject(path: string): Promise<Project> {
    return invoke<Project>('add_project', { path })
  }

  removeProject(projectId: string): Promise<void> {
    return invoke('remove_project', { projectId: parseInt(projectId) })
  }
}

export class TauriDebriefService implements IDebriefService {
  getPendingCommits(projectId: string): Promise<Commit[]> {
    return invoke<Commit[]>('get_pending_commits', { projectId: parseInt(projectId) })
  }

  getReviewedCommits(projectId: string): Promise<Commit[]> {
    return invoke<Commit[]>('get_reviewed_commits', { projectId: parseInt(projectId) })
  }

  async getDebriefByCommit(commitHash: string): Promise<DebriefResult | null> {
    const project = await invoke<Project | null>('get_active_project')
    if (!project) return null
    return invoke<DebriefResult | null>('get_debrief_by_commit', {
      projectId: parseInt(project.id),
      commitHash,
    })
  }

  async runDebrief(commitHash: string): Promise<DebriefResult> {
    const project = await invoke<Project | null>('get_active_project')
    if (!project) throw new Error('No active project set')
    return invoke<DebriefResult>('run_debrief', {
      projectId: parseInt(project.id),
      commitHash,
    })
  }

  markReviewed(debriefId: string): Promise<void> {
    return invoke('mark_reviewed', { debriefId: parseInt(debriefId) })
  }

  async getDiffContent(commitHash: string): Promise<FileDiff[]> {
    const project = await invoke<Project | null>('get_active_project')
    if (!project) return []
    return invoke<FileDiff[]>('get_diff_content', {
      projectId: parseInt(project.id),
      commitHash,
    })
  }

  getGapCount(projectId: string): Promise<number> {
    return invoke<number>('get_gap_count', { projectId: parseInt(projectId) })
  }
}

export class TauriCheckpointService implements ICheckpointService {
  async submitCheckpoint(debriefId: string, questionId: string, answer: string): Promise<Evaluation> {
    // questionText and goodAnswerIncludes are left empty — the backend looks them up
    // from the debrief's stored AI response using the questionId
    const result = await invoke<CheckpointResponse>('submit_checkpoint', {
      debriefId: parseInt(debriefId),
      questionId,
      questionText: '',
      goodAnswerIncludes: '',
      answer,
      mode: 'free_text',
    })
    return result.evaluation || { score: 0, feedback: '', keyPointsCovered: [], keyPointsMissed: [] }
  }

  getResponses(debriefId: string): Promise<CheckpointResponse[]> {
    return invoke<CheckpointResponse[]>('get_checkpoint_responses', {
      debriefId: parseInt(debriefId),
    })
  }
}

export class TauriKnowledgeService implements IKnowledgeService {
  getNotes(): Promise<KnowledgeNote[]> {
    return invoke<KnowledgeNote[]>('get_notes')
  }

  async getNote(noteId: string): Promise<KnowledgeNote | null> {
    return invoke<KnowledgeNote | null>('get_note', { noteId: parseInt(noteId) })
  }

  async saveNote(note: Partial<KnowledgeNote> & { title: string; content: string; categoryPath: string }): Promise<KnowledgeNote> {
    return invoke<KnowledgeNote>('save_note', {
      title: note.title,
      content: note.content,
      categoryPath: note.categoryPath,
      tags: note.tags || [],
      noteId: note.id ? parseInt(note.id) : null,
    })
  }

  deleteNote(noteId: string): Promise<void> {
    return invoke('delete_note', { noteId: parseInt(noteId) })
  }

  searchNotes(query: string): Promise<KnowledgeNote[]> {
    return invoke<KnowledgeNote[]>('search_notes', { query })
  }

  writeToKb(debriefId: string, noteIndices: number[]): Promise<KnowledgeNote[]> {
    return invoke<KnowledgeNote[]>('write_to_kb', {
      debriefId: parseInt(debriefId),
      noteIndices,
    })
  }
}

export class TauriSettingsService implements ISettingsService {
  getSettings(): Promise<AppSettings> {
    return invoke<AppSettings>('get_settings')
  }

  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return invoke<AppSettings>('update_settings', { settings })
  }

  getSkills(): Promise<Skill[]> {
    return invoke<Skill[]>('get_skills')
  }

  toggleSkill(skillId: string, enabled: boolean): Promise<void> {
    return invoke('toggle_skill', { skillId, enabled })
  }

  addSkill(skill: Omit<Skill, 'id' | 'autoDetected' | 'builtIn'>): Promise<Skill> {
    return invoke<Skill>('add_skill', {
      name: skill.name,
      content: skill.content,
      tags: skill.tags,
    })
  }

  testConnection(): Promise<{ success: boolean; message: string }> {
    return invoke<{ success: boolean; message: string }>('test_connection')
  }
}
