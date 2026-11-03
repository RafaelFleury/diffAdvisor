import { invoke } from '@tauri-apps/api/core'
import type {
  AnalyzeParams,
  CodeGraph,
  CodeGraphStatus,
  ExplainTermRequest,
  KeywordDoc,
  SourceFile,
  TermExplanation,
} from '@/types/codegraph.ts'
import type { ICodeGraphService } from './types.ts'

export class TauriCodeGraphService implements ICodeGraphService {
  getStatus(): Promise<CodeGraphStatus> {
    return invoke<CodeGraphStatus>('codegraph_status')
  }

  analyze(projectId: string, params: AnalyzeParams): Promise<CodeGraph> {
    return invoke<CodeGraph>('analyze_graph', { projectId: parseInt(projectId), params })
  }

  getSource(projectId: string, fileId: string): Promise<SourceFile> {
    return invoke<SourceFile>('get_source', { projectId: parseInt(projectId), fileId })
  }

  getKeywordDoc(language: string, term: string): Promise<KeywordDoc | null> {
    return invoke<KeywordDoc | null>('get_keyword_doc', { language, term })
  }

  explainTerm(projectId: string, request: ExplainTermRequest): Promise<TermExplanation> {
    return invoke<TermExplanation>('explain_term', { projectId: parseInt(projectId), request })
  }

  cancelExplain(): Promise<void> {
    return invoke('cancel_ai_run')
  }
}
