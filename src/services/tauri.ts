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
import type {
  IProjectService,
  IDebriefService,
  ICheckpointService,
  IKnowledgeService,
  ISettingsService,
} from './types.ts'

const notImplemented = (method: string): never => {
  throw new Error(`TauriService.${method} is not implemented. Build the Rust backend first.`)
}

export class TauriProjectService implements IProjectService {
  getProjects(): Promise<Project[]> { return notImplemented('getProjects') }
  getActiveProject(): Promise<Project | null> { return notImplemented('getActiveProject') }
  setActiveProject(_id: string): Promise<void> { return notImplemented('setActiveProject') }
  addProject(_path: string): Promise<Project> { return notImplemented('addProject') }
  removeProject(_id: string): Promise<void> { return notImplemented('removeProject') }
}

export class TauriDebriefService implements IDebriefService {
  getPendingCommits(_id: string): Promise<Commit[]> { return notImplemented('getPendingCommits') }
  getReviewedCommits(_id: string): Promise<Commit[]> { return notImplemented('getReviewedCommits') }
  getDebriefByCommit(_hash: string): Promise<DebriefResult | null> { return notImplemented('getDebriefByCommit') }
  runDebrief(_hash: string): Promise<DebriefResult> { return notImplemented('runDebrief') }
  markReviewed(_id: string): Promise<void> { return notImplemented('markReviewed') }
  getDiffContent(_hash: string): Promise<string> { return notImplemented('getDiffContent') }
  getGapCount(_id: string): Promise<number> { return notImplemented('getGapCount') }
}

export class TauriCheckpointService implements ICheckpointService {
  submitCheckpoint(_debriefId: string, _questionId: string, _answer: string): Promise<Evaluation> { return notImplemented('submitCheckpoint') }
  getResponses(_debriefId: string): Promise<CheckpointResponse[]> { return notImplemented('getResponses') }
}

export class TauriKnowledgeService implements IKnowledgeService {
  getNotes(): Promise<KnowledgeNote[]> { return notImplemented('getNotes') }
  getNote(_id: string): Promise<KnowledgeNote | null> { return notImplemented('getNote') }
  saveNote(_note: Partial<KnowledgeNote> & { title: string; content: string; categoryPath: string }): Promise<KnowledgeNote> { return notImplemented('saveNote') }
  deleteNote(_id: string): Promise<void> { return notImplemented('deleteNote') }
  searchNotes(_query: string): Promise<KnowledgeNote[]> { return notImplemented('searchNotes') }
}

export class TauriSettingsService implements ISettingsService {
  getSettings(): Promise<AppSettings> { return notImplemented('getSettings') }
  updateSettings(_settings: Partial<AppSettings>): Promise<AppSettings> { return notImplemented('updateSettings') }
  getSkills(): Promise<Skill[]> { return notImplemented('getSkills') }
  toggleSkill(_id: string, _enabled: boolean): Promise<void> { return notImplemented('toggleSkill') }
  testConnection(): Promise<{ success: boolean; message: string }> { return notImplemented('testConnection') }
}
