import { IS_MOCK_SERVICES } from '@/services/index.ts'
import { MockCodeGraphService } from './mock.ts'
import { TauriCodeGraphService } from './tauri.ts'
import type { ICodeGraphService } from './types.ts'

export type { ICodeGraphService } from './types.ts'

export const codeGraphService: ICodeGraphService = IS_MOCK_SERVICES
  ? new MockCodeGraphService()
  : new TauriCodeGraphService()
