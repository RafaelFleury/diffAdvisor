export type Theme = 'dark' | 'light'
export type AnalysisDepth = 'quick' | 'balanced' | 'deep'
export type DebriefLanguage = 'english' | 'portuguese' | 'auto'
export type AIProvider = 'opencode' | 'claude-code' | 'codex' | 'api'
/** Providers that run a coding-agent CLI. */
export type AgentProvider = Exclude<AIProvider, 'api'>

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
  /** Claude Code model alias or id; empty uses the CLI's default. */
  claudeCodeModel: string
  /** Codex model id; empty uses the model from ~/.codex/config.toml. */
  codexModel: string
  endpointUrl: string
  model: string
  apiKey: string
  contextWindow: string
  webSearch: boolean
}

export interface AgentStatus {
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
