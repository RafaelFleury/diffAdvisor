import { useCallback, useEffect, useState } from 'react'
import Toggle from '@/components/ui/Toggle.tsx'
import Select from '@/components/ui/Select.tsx'
import { settingsService } from '@/services/index.ts'
import type { AgentProvider, AgentStatus, AIProvider, AppSettings, OpencodeModel } from '@/types/index.ts'

interface AIProviderSettingsProps {
  settings: AppSettings
  connectionTestResult: { success: boolean; message: string } | null
  onUpdate: (partial: Partial<AppSettings>) => void
  onTestConnection: () => void | Promise<void>
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text)',
  minWidth: 180,
  flexShrink: 0,
  fontFamily: "'JetBrains Mono', monospace",
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  fontFamily: "'JetBrains Mono', monospace",
}

const auxButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  backgroundColor: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-secondary)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'JetBrains Mono', monospace",
  whiteSpace: 'nowrap',
}

const rowStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--border-light)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 16,
}

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-tertiary)',
  lineHeight: 1.5,
  fontFamily: "'JetBrains Mono', monospace",
}

const AGENT_INFO: Record<AgentProvider, { label: string; install: React.ReactNode; note: string }> = {
  opencode: {
    label: 'opencode',
    install: (
      <>
        Install it with <code>curl -fsSL https://opencode.ai/install | bash</code> (see opencode.ai), then press
        Recheck. No login is needed for the free models.
      </>
    ),
    note: 'Free models are hosted by opencode. Review their data-use terms before analyzing proprietary code.',
  },
  'claude-code': {
    label: 'Claude Code',
    install: (
      <>
        Install it with <code>curl -fsSL https://claude.ai/install.sh | bash</code>, run <code>claude</code> once in a
        terminal to log in, then press Recheck.
      </>
    ),
    note: 'Uses your Claude Code login and its usage limits. It can read only the repository, the commit diff and the knowledge base.',
  },
  codex: {
    label: 'Codex',
    install: (
      <>
        Install it with <code>npm install -g @openai/codex</code>, run <code>codex login</code> in a terminal, then
        press Recheck.
      </>
    ),
    note: "Uses your Codex login, its usage limits and ~/.codex/config.toml. It runs in Codex's read-only sandbox, which cannot change files but can read any folder you can.",
  },
}

const CLAUDE_CODE_MODELS = [
  { id: 'fable', name: 'Fable (latest)' },
  { id: 'opus', name: 'Opus (latest)' },
  { id: 'sonnet', name: 'Sonnet (latest)' },
  { id: 'haiku', name: 'Haiku (latest)' },
]

const formatContext = (tokens: number) =>
  tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M` : `${Math.round(tokens / 1000)}k`

export default function AIProviderSettings({ settings, connectionTestResult, onUpdate, onTestConnection }: AIProviderSettingsProps) {
  const [testingConnection, setTestingConnection] = useState(false)
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null)
  const [opencodeModels, setOpencodeModels] = useState<OpencodeModel[]>([])
  const [agentError, setAgentError] = useState<string | null>(null)
  const [checkingAgent, setCheckingAgent] = useState(false)
  const agentProvider: AgentProvider | null = settings.ai.provider === 'api' ? null : settings.ai.provider
  const agentInfo = agentProvider ? AGENT_INFO[agentProvider] : null

  const checkAgent = useCallback(async (provider: AgentProvider) => {
    setCheckingAgent(true)
    setAgentStatus(null)
    setAgentError(null)
    try {
      const status = await settingsService.getAgentStatus(provider)
      setAgentStatus(status)
      setOpencodeModels(provider === 'opencode' && status.installed ? await settingsService.listOpencodeModels() : [])
    } catch (e) {
      setAgentError((e as Error).message)
    } finally {
      setCheckingAgent(false)
    }
  }, [])

  useEffect(() => {
    if (agentProvider) void checkAgent(agentProvider)
  }, [agentProvider, checkAgent])

  const savedModelMissing =
    settings.ai.opencodeModel !== '' &&
    opencodeModels.length > 0 &&
    !opencodeModels.some((m) => m.id === settings.ai.opencodeModel)
  const customClaudeModel =
    settings.ai.claudeCodeModel !== '' && !CLAUDE_CODE_MODELS.some((m) => m.id === settings.ai.claudeCodeModel)

  const handleTestConnection = async () => {
    if (testingConnection) return
    setTestingConnection(true)
    try {
      await onTestConnection()
    } finally {
      setTestingConnection(false)
    }
  }

  const statusMessage = testingConnection ? 'Testing connection...' : connectionTestResult?.message
  const statusColor = testingConnection
    ? 'var(--warning)'
    : connectionTestResult?.success
      ? 'var(--success)'
      : 'var(--critical)'

  const testButton = (
    <button
      style={{
        ...auxButtonStyle,
        opacity: testingConnection ? 0.65 : 1,
        cursor: testingConnection ? 'not-allowed' : 'pointer',
      }}
      onClick={() => void handleTestConnection()}
      disabled={testingConnection}
    >
      {testingConnection ? 'Testing...' : 'Test'}
    </button>
  )

  return (
    <>
      <div style={rowStyle}>
        <span style={labelStyle}>Provider</span>
        <Select
          value={settings.ai.provider}
          onChange={(e) => onUpdate({ ai: { ...settings.ai, provider: e.target.value as AIProvider } })}
        >
          <option value="opencode">opencode (free models, explores the repo)</option>
          <option value="claude-code">Claude Code (your Claude login, explores the repo)</option>
          <option value="codex">Codex (your ChatGPT/OpenAI login, explores the repo)</option>
          <option value="api">API key (legacy)</option>
        </Select>
      </div>
      {agentProvider && agentInfo ? (
        <>
          <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
            <span style={{ ...labelStyle, paddingTop: 2 }}>{agentInfo.label}</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 12,
                    color: !agentStatus
                      ? 'var(--text-tertiary)'
                      : agentStatus.installed
                        ? 'var(--success)'
                        : 'var(--warning)',
                  }}
                >
                  {!agentStatus
                    ? agentError
                      ? 'Check failed'
                      : 'Checking...'
                    : agentStatus.installed
                      ? `Installed${agentStatus.version ? ` (v${agentStatus.version})` : ''}`
                      : 'Not found'}
                </span>
                <button
                  style={auxButtonStyle}
                  onClick={() => void checkAgent(agentProvider)}
                  disabled={checkingAgent}
                >
                  {checkingAgent ? '...' : 'Recheck'}
                </button>
              </div>
              {agentStatus && !agentStatus.installed && <span style={hintStyle}>{agentInfo.install}</span>}
              {agentStatus?.path && <span style={hintStyle}>{agentStatus.path}</span>}
              {agentError && (
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--critical)' }}>
                  {agentError}
                </span>
              )}
            </div>
          </div>
          <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
            <span style={{ ...labelStyle, paddingTop: 8 }}>Model</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {agentProvider === 'opencode' && (
                  <Select
                    value={settings.ai.opencodeModel}
                    onChange={(e) => onUpdate({ ai: { ...settings.ai, opencodeModel: e.target.value } })}
                    disabled={!agentStatus?.installed}
                  >
                    <option value="">Automatic (first free model)</option>
                    {savedModelMissing && (
                      <option value={settings.ai.opencodeModel}>{settings.ai.opencodeModel} (no longer listed)</option>
                    )}
                    {opencodeModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                        {model.contextWindow > 0 ? ` · ${formatContext(model.contextWindow)} context` : ''}
                      </option>
                    ))}
                  </Select>
                )}
                {agentProvider === 'claude-code' && (
                  <Select
                    value={settings.ai.claudeCodeModel}
                    onChange={(e) => onUpdate({ ai: { ...settings.ai, claudeCodeModel: e.target.value } })}
                    disabled={!agentStatus?.installed}
                  >
                    <option value="">Default (Claude Code's own setting)</option>
                    {customClaudeModel && <option value={settings.ai.claudeCodeModel}>{settings.ai.claudeCodeModel}</option>}
                    {CLAUDE_CODE_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </Select>
                )}
                {agentProvider === 'codex' && (
                  <input
                    style={inputStyle}
                    value={settings.ai.codexModel}
                    onChange={(e) => onUpdate({ ai: { ...settings.ai, codexModel: e.target.value } })}
                    placeholder="Default (from ~/.codex/config.toml)"
                    disabled={!agentStatus?.installed}
                  />
                )}
                {testButton}
              </div>
              <span style={hintStyle}>{agentInfo.note}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={rowStyle}>
            <span style={labelStyle}>Endpoint</span>
            <input
              style={inputStyle}
              value={settings.ai.endpointUrl}
              onChange={(e) => onUpdate({ ai: { ...settings.ai, endpointUrl: e.target.value } })}
              placeholder="https://api.anthropic.com/v1"
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Model</span>
            <input
              style={inputStyle}
              value={settings.ai.model}
              onChange={(e) => onUpdate({ ai: { ...settings.ai, model: e.target.value } })}
              placeholder="Claude Sonnet 4"
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Context Window</span>
            <input
              style={inputStyle}
              type="number"
              min={4000}
              step={1000}
              value={settings.ai.contextWindow}
              onChange={(e) => onUpdate({ ai: { ...settings.ai, contextWindow: e.target.value } })}
              placeholder="128000"
            />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>API Key</span>
            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
              <input style={inputStyle} type="password" value={settings.ai.apiKey} onChange={(e) => onUpdate({ ai: { ...settings.ai, apiKey: e.target.value } })} />
              {testButton}
            </div>
          </div>
        </>
      )}
      {statusMessage && (
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={labelStyle} />
          <span className="font-mono" style={{ fontSize: 12, color: statusColor }}>
            {statusMessage}
          </span>
        </div>
      )}
      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <span style={labelStyle}>Web Search</span>
        <Toggle
          checked={settings.ai.webSearch}
          onChange={(v) => onUpdate({ ai: { ...settings.ai, webSearch: v } })}
          label="Search for CVEs and best practices"
        />
      </div>
    </>
  )
}
