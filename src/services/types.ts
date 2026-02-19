import type {
  Project,
  Commit,
  DebriefResult,
  CheckpointResponse,
  Evaluation,
  KnowledgeNote,
  Skill,
  AppSettings,
} from '@/types/index.ts'

export interface IProjectService {
  getProjects(): Promise<Project[]>
  getActiveProject(): Promise<Project | null>
  setActiveProject(projectId: string): Promise<void>
  addProject(path: string): Promise<Project>
  removeProject(projectId: string): Promise<void>
}

export interface IDebriefService {
  getPendingCommits(projectId: string): Promise<Commit[]>
  getReviewedCommits(projectId: string): Promise<Commit[]>
  getDebriefByCommit(commitHash: string): Promise<DebriefResult | null>
  runDebrief(commitHash: string): Promise<DebriefResult>
  markReviewed(debriefId: string): Promise<void>
  getDiffContent(commitHash: string): Promise<string>
  getGapCount(projectId: string): Promise<number>
}

export interface ICheckpointService {
  submitCheckpoint(
    debriefId: string,
    questionId: string,
    answer: string
  ): Promise<Evaluation>
  getResponses(debriefId: string): Promise<CheckpointResponse[]>
}

export interface IKnowledgeService {
  getNotes(): Promise<KnowledgeNote[]>
  getNote(noteId: string): Promise<KnowledgeNote | null>
  saveNote(note: Partial<KnowledgeNote> & { title: string; content: string; categoryPath: string }): Promise<KnowledgeNote>
  deleteNote(noteId: string): Promise<void>
  searchNotes(query: string): Promise<KnowledgeNote[]>
}

export interface ISettingsService {
  getSettings(): Promise<AppSettings>
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>
  getSkills(): Promise<Skill[]>
  toggleSkill(skillId: string, enabled: boolean): Promise<void>
  testConnection(): Promise<{ success: boolean; message: string }>
}
