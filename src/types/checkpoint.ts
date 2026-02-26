export type CheckpointMode = 'free_text' | 'multiple_choice'

export interface CheckpointQuestion {
  id: string
  question: string
  concept: string
  goodAnswerIncludes: string
  options?: string[]
  correctOptionIndex?: number
}

export interface CheckpointResponse {
  id: string
  debriefId: string
  questionId: string
  questionText: string
  responseText: string
  evaluation: Evaluation | null
  mode: CheckpointMode
  createdAt: string
}

export interface Evaluation {
  score: number
  feedback: string
  keyPointsCovered: string[]
  keyPointsMissed: string[]
}
