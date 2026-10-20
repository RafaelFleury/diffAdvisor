export type Theme = 'dark' | 'light'
export type AnalysisDepth = 'quick' | 'balanced' | 'deep'
export type DebriefLanguage = 'english' | 'portuguese' | 'auto'
export type AIProvider = 'opencode' | 'api'

export interface ProjectSettings {
  monitoredDirectory: string
  fileExtensions: string
  ignoredPaths: string
  hasGitignore: boolean
  onlyMyCommits: boolean
  extraAuthorEmails: string
}

export interface AISettings {
  provider: AIProvider
  opencodeModel: string
  endpointUrl: string
  model: string
  apiKey: string
  contextWindow: string
  webSearch: boolean
}

export interface OpencodeStatus {
  installed: boolean
  path: string | null
  version: string | null
}

export interface OpencodeModel {
  id: string
  name: string
  contextWindow: number
}

export interface AnalysisSettings {
  autoAnalyze: boolean
  checkpointMode: import('./checkpoint.ts').CheckpointMode
  analysisDepth: AnalysisDepth
}

export interface KnowledgeSettings {
  storagePath: string
  autoGenerateNotes: boolean
}

export interface AppearanceSettings {
  theme: Theme
  debriefLanguage: DebriefLanguage
}

export interface AppSettings {
  project: ProjectSettings
  ai: AISettings
  analysis: AnalysisSettings
  knowledge: KnowledgeSettings
  appearance: AppearanceSettings
}
