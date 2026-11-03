import { useCallback, useEffect, useState } from 'react'
import Toggle from '@/components/ui/Toggle.tsx'
import Select from '@/components/ui/Select.tsx'
import { settingsService } from '@/services/index.ts'
import type { AgentModel, AgentProvider, AgentStatus, AIProvider, AISettings, AppSettings } from '@/types/index.ts'

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

/** Claude Code accepts the same `--effort` levels for every model alias. */
const CLAUDE_CODE_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']

const CLAUDE_CODE_MODELS: AgentModel[] = [
  { id: 'fable', name: 'Fable (latest)', contextWindow: 0, reasoningLevels: CLAUDE_CODE_LEVELS },
  { id: 'opus', name: 'Opus (latest)', contextWindow: 0, reasoningLevels: CLAUDE_CODE_LEVELS },
  { id: 'sonnet', name: 'Sonnet (latest)', contextWindow: 0, reasoningLevels: CLAUDE_CODE_LEVELS },
  { id: 'haiku', name: 'Haiku (latest)', contextWindow: 0, reasoningLevels: CLAUDE_CODE_LEVELS },
]

/** Which settings hold each agent CLI's model and reasoning effort. */
const AGENT_FIELDS = {
  opencode: { model: 'opencodeModel', effort: 'opencodeEffort', defaultModel: 'Automatic (first free model)' },
  'claude-code': { model: 'claudeCodeModel', effort: 'claudeCodeEffort', defaultModel: "Default (Claude Code's own setting)" },
  codex: { model: 'codexModel', effort: 'codexEffort', defaultModel: 'Default (from ~/.codex/config.toml)' },
} as const satisfies Record<AgentProvider, { model: keyof AISettings; effort: keyof AISettings; defaultModel: string }>

const formatContext = (tokens: number) =>
  tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M` : `${Math.round(tokens / 1000)}k`

export default function AIProviderSettings({ settings, connectionTestResult, onUpdate, onTestConnection }: AIProviderSettingsProps) {
  const [testingConnection, setTestingConnection] = useState(false)
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null)
  const [agentModels, setAgentModels] = useState<AgentModel[]>([])
  const [codexDefaults, setCodexDefaults] = useState<{ model: string | null; effort: string | null }>({
    model: null,
    effort: null,
  })
  const [agentError, setAgentError] = useState<string | null>(null)
  const [checkingAgent, setCheckingAgent] = useState(false)
  const agentProvider: AgentProvider | null = settings.ai.provider === 'api' ? null : settings.ai.provider
  const agentInfo = agentProvider ? AGENT_INFO[agentProvider] : null

  const checkAgent = useCallback(async (provider: AgentProvider) => {
    setCheckingAgent(true)
    setAgentStatus(null)
    setAgentError(null)
    setAgentModels([])
    try {
      const status = await settingsService.getAgentStatus(provider)
      setAgentStatus(status)
      if (!status.installed) return
      if (provider === 'opencode') {
        setAgentModels(await settingsService.listOpencodeModels())
      } else if (provider === 'claude-code') {
        setAgentModels(CLAUDE_CODE_MODELS)
      } else {
        const codex = await settingsService.listCodexModels()
        setAgentModels(codex.models)
        setCodexDefaults({ model: codex.defaultModel, effort: codex.defaultEffort })
      }
    } catch (e) {
      setAgentError((e as Error).message)
    } finally {
      setCheckingAgent(false)
    }
  }, [])

  useEffect(() => {
    if (agentProvider) void checkAgent(agentProvider)
  }, [agentProvider, checkAgent])

  const fields = agentProvider ? AGENT_FIELDS[agentProvider] : null
  const modelValue = fields ? settings.ai[fields.model] : ''
  const effortValue = fields ? settings.ai[fields.effort] : ''
  const savedModelMissing = modelValue !== '' && agentModels.length > 0 && !agentModels.some((m) => m.id === modelValue)
  // The model a run will actually use, to know which reasoning levels apply.
  const effectiveModelId = modelValue || (agentProvider === 'codex' ? codexDefaults.model : null)
  const effectiveModel = agentModels.find((m) => m.id === effectiveModelId)
  const reasoningLevels =
    effectiveModel?.reasoningLevels ?? (agentProvider === 'claude-code' ? CLAUDE_CODE_LEVELS : [])
  const savedEffortMissing = effortValue !== '' && !reasoningLevels.includes(effortValue)
  const defaultEffortLabel =
    agentProvider === 'codex' && codexDefaults.effort ? `Default (${codexDefaults.effort}, from config)` : 'Default'
  const reasoningHint =
    agentProvider === 'opencode' && !modelValue
      ? 'Pick a model to choose its reasoning level.'
      : reasoningLevels.length === 0 && agentModels.length > 0
        ? 'This model has no reasoning levels to choose from.'
        : 'Higher levels think longer: better analyses, but slower and they use more of your limits.'

  const changeModel = (model: string) => {
    if (!fields) return
    const levels =
      agentModels.find((m) => m.id === (model || (agentProvider === 'codex' ? codexDefaults.model : null)))
        ?.reasoningLevels ?? (agentProvider === 'claude-code' ? CLAUDE_CODE_LEVELS : [])
    // A level the new model doesn't accept would make runs fail; fall back to the default.
    const effort = levels.includes(effortValue) ? effortValue : ''
    onUpdate({ ai: { ...settings.ai, [fields.model]: model, [fields.effort]: effort } })
  }

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
                <Select
                  value={modelValue}
                  onChange={(e) => changeModel(e.target.value)}
                  disabled={!agentStatus?.installed}
                >
                  <option value="">
                    {AGENT_FIELDS[agentProvider].defaultModel}
                    {agentProvider === 'codex' && codexDefaults.model ? `: ${codexDefaults.model}` : ''}
                  </option>
                  {savedModelMissing && (
                    <option value={modelValue}>
                      {modelValue}
                      {agentProvider === 'opencode' ? ' (no longer listed)' : ''}
                    </option>
                  )}
                  {agentModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                      {model.contextWindow > 0 ? ` · ${formatContext(model.contextWindow)} context` : ''}
                    </option>
                  ))}
                </Select>
                {testButton}
              </div>
              <span style={hintStyle}>{agentInfo.note}</span>
            </div>
          </div>
          <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
            <span style={{ ...labelStyle, paddingTop: 8 }}>Reasoning</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Select
                value={effortValue}
                onChange={(e) => fields && onUpdate({ ai: { ...settings.ai, [fields.effort]: e.target.value } })}
                disabled={!agentStatus?.installed || (reasoningLevels.length === 0 && !savedEffortMissing)}
              >
                <option value="">{defaultEffortLabel}</option>
                {savedEffortMissing && <option value={effortValue}>{effortValue} (not offered by this model)</option>}
                {reasoningLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>
              <span style={hintStyle}>{reasoningHint}</span>
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
