export interface SkillDetectConfig {
  files: string[]
  contentPatterns: string[]
  extensions: string[]
}

export interface Skill {
  id: string
  name: string
  description: string
  tags: string[]
  detect: SkillDetectConfig
  content: string
  enabled: boolean
  autoDetected: boolean
  builtIn: boolean
}
