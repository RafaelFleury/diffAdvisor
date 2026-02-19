export type Theme = 'dark' | 'light'
export type AnalysisDepth = 'quick' | 'balanced' | 'deep'
export type DebriefLanguage = 'english' | 'portuguese' | 'auto'

export interface ProjectSettings {
  monitoredDirectory: string
  fileExtensions: string
  ignoredPaths: string
}

export interface AISettings {
  endpointUrl: string
  model: string
  apiKey: string
  provider: 'anthropic' | 'openai'
  webSearch: boolean
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
