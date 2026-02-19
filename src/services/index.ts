import {
  MockProjectService,
  MockDebriefService,
  MockCheckpointService,
  MockKnowledgeService,
  MockSettingsService,
} from './mock.ts'
import {
  TauriProjectService,
  TauriDebriefService,
  TauriCheckpointService,
  TauriKnowledgeService,
  TauriSettingsService,
} from './tauri.ts'

const USE_MOCK = import.meta.env.DEV

export const projectService = USE_MOCK ? new MockProjectService() : new TauriProjectService()
export const debriefService = USE_MOCK ? new MockDebriefService() : new TauriDebriefService()
export const checkpointService = USE_MOCK ? new MockCheckpointService() : new TauriCheckpointService()
export const knowledgeService = USE_MOCK ? new MockKnowledgeService() : new TauriKnowledgeService()
export const settingsService = USE_MOCK ? new MockSettingsService() : new TauriSettingsService()
