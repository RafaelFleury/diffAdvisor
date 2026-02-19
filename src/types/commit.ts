export type CommitStatus = 'pending' | 'reviewed'

export interface Commit {
  hash: string
  message: string
  author: string
  timestamp: string
  filesChanged: number
  additions: number
  deletions: number
  status: CommitStatus
}
