import { useState } from 'react'
import type { CheckpointQuestion, Evaluation } from '@/types/index.ts'

interface CheckpointSectionProps {
  questions: CheckpointQuestion[]
  answers: Record<string, { text: string; evaluation: Evaluation | null }>
  onSubmitAnswer: (questionId: string, answer: string) => Promise<void>
}

export default function CheckpointSection({ questions, answers, onSubmitAnswer }: CheckpointSectionProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [inputText, setInputText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currentQuestion = questions[activeTab]
  if (!currentQuestion) return null
  const currentAnswer = answers[currentQuestion.id]

  const handleSubmit = async () => {
    if (!inputText.trim() || submitting) return
    setSubmitting(true)
    try {
      await onSubmitAnswer(currentQuestion.id, inputText)
      setInputText('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {questions.map((q, i) => {
          const isActive = i === activeTab
          const hasAnswer = !!answers[q.id]
          return (
            <button
              key={q.id}
              onClick={() => {
                setActiveTab(i)
                setInputText('')
              }}
              className="font-mono"
              style={{
                padding: '4px 12px',
                fontSize: 12,
                borderRadius: 4,
                cursor: 'pointer',
                border: `1px solid ${isActive ? 'transparent' : 'var(--border)'}`,
                backgroundColor: isActive ? 'var(--text)' : 'transparent',
                color: isActive ? 'var(--bg)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              Q{i + 1}{hasAnswer ? ' \u2713' : ''}
            </button>
          )
        })}
      </div>

      {/* Question */}
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--text)',
          padding: '14px 16px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 6,
          border: '1px solid var(--border)',
          marginBottom: 14,
        }}
      >
        {currentQuestion.question}
      </div>

      {/* Answer area or submitted answer */}
      {currentAnswer ? (
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: 'var(--success-bg)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 6,
          }}
        >
          <div className="font-mono" style={{ fontSize: 12, fontWeight: 500, color: 'var(--success)', marginBottom: 6 }}>
            Your answer:
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {currentAnswer.text}
          </div>
          {currentAnswer.evaluation && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(34, 197, 94, 0.15)' }}>
              <div className="font-mono" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
                Score: {currentAnswer.evaluation.score}/10
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                {currentAnswer.evaluation.feedback}
              </div>
              {currentAnswer.evaluation.keyPointsCovered.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--success)' }}>Covered: </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {currentAnswer.evaluation.keyPointsCovered.join(', ')}
                  </span>
                </div>
              )}
              {currentAnswer.evaluation.keyPointsMissed.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--warning)' }}>Missed: </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {currentAnswer.evaluation.keyPointsMissed.join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <textarea
            className="font-mono"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your answer..."
            style={{
              width: '100%',
              minHeight: 80,
              padding: '10px 12px',
              fontSize: 13,
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              lineHeight: 1.6,
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--text-tertiary)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />
          <button
            onClick={handleSubmit}
            className="font-mono"
            disabled={!inputText.trim() || submitting}
            style={{
              marginTop: 8,
              padding: '7px 18px',
              fontSize: 12,
              backgroundColor: 'var(--text)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: 6,
              fontWeight: 500,
              cursor: inputText.trim() && !submitting ? 'pointer' : 'default',
              opacity: inputText.trim() && !submitting ? 1 : 0.4,
              transition: 'opacity 0.15s ease',
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Answer'}
          </button>
        </>
      )}
    </div>
  )
}
