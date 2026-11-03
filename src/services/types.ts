import type {
  Project,
  Commit,
  PendingCommitsPage,
  DebriefResult,
  FileDiff,
  CheckpointResponse,
  Evaluation,
  KnowledgeNote,
  Skill,
  AppSettings,
  AgentProvider,
  AgentStatus,
  OpencodeModel,
} from '@/types/index.ts'

export interface IProjectService {
  getProjects(): Promise<Project[]>
  getActiveProject(): Promise<Project | null>
  setActiveProject(projectId: string): Promise<void>
  addProject(path: string): Promise<Project>
  removeProject(projectId: string): Promise<void>
}

export interface IDebriefService {
  getPendingCommits(projectId: string, limit?: number): Promise<PendingCommitsPage>
  getReviewedCommits(projectId: string): Promise<Commit[]>
  getDebriefByCommit(commitHash: string): Promise<DebriefResult | null>
  runDebrief(commitHash: string): Promise<DebriefResult>
  /** Streams what the AI agent is doing while a debrief runs. Resolves to an unsubscribe function. */
  onDebriefProgress(commitHash: string, callback: (message: string) => void): Promise<() => void>
  cancelDebrief(): Promise<void>
  markReviewed(debriefId: string): Promise<void>
  getDiffContent(commitHash: string): Promise<FileDiff[]>
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
  writeToKb(debriefId: string, noteIndices: number[]): Promise<KnowledgeNote[]>
  /** Streams progress while writeToKb generates notes. Resolves to an unsubscribe function. */
  onKbProgress(debriefId: string, callback: (message: string) => void): Promise<() => void>
}

export interface ISettingsService {
  getSettings(): Promise<AppSettings>
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>
  getSkills(): Promise<Skill[]>
  toggleSkill(skillId: string, enabled: boolean): Promise<void>
  addSkill(skill: Omit<Skill, 'id' | 'autoDetected' | 'builtIn'>): Promise<Skill>
  testConnection(): Promise<{ success: boolean; message: string }>
  getAgentStatus(provider: AgentProvider): Promise<AgentStatus>
  listOpencodeModels(): Promise<OpencodeModel[]>
}
