import { useCallback, useEffect, useState } from 'react'
import Toggle from '@/components/ui/Toggle.tsx'
import Select from '@/components/ui/Select.tsx'
import { settingsService } from '@/services/index.ts'
import type { AIProvider, AppSettings, OpencodeModel, OpencodeStatus } from '@/types/index.ts'

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

const formatContext = (tokens: number) =>
  tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M` : `${Math.round(tokens / 1000)}k`

export default function AIProviderSettings({ settings, connectionTestResult, onUpdate, onTestConnection }: AIProviderSettingsProps) {
  const [testingConnection, setTestingConnection] = useState(false)
  const [opencodeStatus, setOpencodeStatus] = useState<OpencodeStatus | null>(null)
  const [opencodeModels, setOpencodeModels] = useState<OpencodeModel[]>([])
  const [opencodeError, setOpencodeError] = useState<string | null>(null)
  const [checkingOpencode, setCheckingOpencode] = useState(false)
  const isOpencode = settings.ai.provider === 'opencode'

  const checkOpencode = useCallback(async () => {
    setCheckingOpencode(true)
    setOpencodeError(null)
    try {
      const status = await settingsService.getOpencodeStatus()
      setOpencodeStatus(status)
      setOpencodeModels(status.installed ? await settingsService.listOpencodeModels() : [])
    } catch (e) {
      setOpencodeError((e as Error).message)
    } finally {
      setCheckingOpencode(false)
    }
  }, [])

  useEffect(() => {
    if (isOpencode) void checkOpencode()
  }, [isOpencode, checkOpencode])

  const savedModelMissing =
    settings.ai.opencodeModel !== '' &&
    opencodeModels.length > 0 &&
    !opencodeModels.some((m) => m.id === settings.ai.opencodeModel)

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
          <option value="api">API key (legacy)</option>
        </Select>
      </div>
      {isOpencode ? (
        <>
          <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
            <span style={{ ...labelStyle, paddingTop: 2 }}>opencode</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 12,
                    color: opencodeStatus?.installed ? 'var(--success)' : 'var(--warning)',
                  }}
                >
                  {checkingOpencode && !opencodeStatus
                    ? 'Checking...'
                    : opencodeStatus?.installed
                      ? `Installed${opencodeStatus.version ? ` (v${opencodeStatus.version})` : ''}`
                      : 'Not found'}
                </span>
                <button style={auxButtonStyle} onClick={() => void checkOpencode()} disabled={checkingOpencode}>
                  {checkingOpencode ? '...' : 'Recheck'}
                </button>
              </div>
              {opencodeStatus && !opencodeStatus.installed && (
                <span style={hintStyle}>
                  Install it with <code>curl -fsSL https://opencode.ai/install | bash</code> (see opencode.ai), then
                  press Recheck. No login is needed for the free models.
                </span>
              )}
              {opencodeStatus?.path && <span style={hintStyle}>{opencodeStatus.path}</span>}
              {opencodeError && (
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--critical)' }}>
                  {opencodeError}
                </span>
              )}
            </div>
          </div>
          <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
            <span style={{ ...labelStyle, paddingTop: 8 }}>Model</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Select
                  value={settings.ai.opencodeModel}
                  onChange={(e) => onUpdate({ ai: { ...settings.ai, opencodeModel: e.target.value } })}
                  disabled={!opencodeStatus?.installed}
                >
                  <option value="">Automatic (first free model)</option>
                  {savedModelMissing && (
                    <option value={settings.ai.opencodeModel}>{settings.ai.opencodeModel} (no longer listed)</option>
                  )}
                  {opencodeModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} · {formatContext(model.contextWindow)} context
                    </option>
                  ))}
                </Select>
                {testButton}
              </div>
              <span style={hintStyle}>
                Free models are hosted by opencode. Review their data-use terms before analyzing proprietary code.
              </span>
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
