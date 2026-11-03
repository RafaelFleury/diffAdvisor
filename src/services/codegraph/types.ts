import type {
  AnalyzeParams,
  CodeGraph,
  CodeGraphStatus,
  ExplainTermRequest,
  KeywordDoc,
  SourceFile,
  TermExplanation,
} from '@/types/codegraph.ts'

export interface ICodeGraphService {
  getStatus(): Promise<CodeGraphStatus>
  analyze(projectId: string, params: AnalyzeParams): Promise<CodeGraph>
  getSource(projectId: string, fileId: string): Promise<SourceFile>
  getKeywordDoc(language: string, term: string): Promise<KeywordDoc | null>
  explainTerm(projectId: string, request: ExplainTermRequest): Promise<TermExplanation>
  cancelExplain(): Promise<void>
}
