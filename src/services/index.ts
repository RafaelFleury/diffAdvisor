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

// IMPORTANT:
// Mock services are disabled by default and only enabled when this flag is explicitly set to true.
const ENABLE_MOCK_SERVICES = false
const USE_MOCK = ENABLE_MOCK_SERVICES
export const IS_MOCK_SERVICES = USE_MOCK

export const projectService = USE_MOCK ? new MockProjectService() : new TauriProjectService()
export const debriefService = USE_MOCK ? new MockDebriefService() : new TauriDebriefService()
export const checkpointService = USE_MOCK ? new MockCheckpointService() : new TauriCheckpointService()
export const knowledgeService = USE_MOCK ? new MockKnowledgeService() : new TauriKnowledgeService()
export const settingsService = USE_MOCK ? new MockSettingsService() : new TauriSettingsService()
