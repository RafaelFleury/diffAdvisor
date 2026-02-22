export type Severity = 'critical' | 'warning' | 'info'
export type GapCategory = 'security' | 'performance' | 'reliability' | 'maintainability'

export interface Decision {
  decision: string
  alternatives: string
  tradeoffs: string
}

export interface Gap {
  id: string
  severity: Severity
  category: GapCategory
  description: string
  explanation: string
  suggestion: string
}

export interface KnowledgeBaseNote {
  title: string
  category: string
  tags: string[]
  linksTo: string[]
  content: string
}

export interface FileDiff {
  fileName: string
  diff: string
  additions: number
  deletions: number
}

export interface DebriefResult {
  id: string
  commitHash: string
  architecturalSummary: string
  patternsIdentified: string[]
  decisionsMade: Decision[]
  gaps: Gap[]
  checkpointQuestions: import('./checkpoint.ts').CheckpointQuestion[]
  knowledgeBaseNotes: KnowledgeBaseNote[]
  skillsUsed: string[]
  status: 'pending' | 'reviewed'
  createdAt: string
}
