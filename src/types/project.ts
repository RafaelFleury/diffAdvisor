export interface Project {
  id: string
  name: string
  path: string
  language: string
  frameworks: string[]
  activeSkills: string[]
  createdAt: string
  lastAnalyzedAt: string | null
}
