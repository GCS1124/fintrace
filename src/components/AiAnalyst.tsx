import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, Check, Clipboard, LoaderCircle, MessageSquareText, RefreshCw, Send, ShieldCheck, Sparkles } from 'lucide-react'
import type { AiAnalysisContext, AiAnalysisObservation, AiAnalysisResult } from '../types'
import { AiAnalysisRequestError, requestGeminiAnalysis } from '../services/aiAnalysisService'
import { formatCount, formatTimestamp } from '../utils/format'
import styles from './AiAnalyst.module.css'

interface AiAnalystProps {
  readonly context: AiAnalysisContext | undefined
  readonly onSelectTransaction: (transactionId: string) => void
}

type RequestState = 'idle' | 'loading' | 'success' | 'error'

const quickQuestions = [
  'What should a reviewer verify next?',
  'Which transfers matter most to this case?',
  'What are the main caveats in this snapshot?',
]

function ObservationCard({ observation, onSelectTransaction }: { readonly observation: AiAnalysisObservation; readonly onSelectTransaction: (transactionId: string) => void }) {
  return (
    <article className={styles.observation}>
      <div className={styles.observationMarker} aria-hidden="true"><span /></div>
      <div className={styles.observationCopy}>
        <strong>{observation.title}</strong>
        <p>{observation.detail}</p>
        {observation.evidenceTransactionIds.length > 0 ? (
          <div className={styles.evidenceChips} aria-label="Supporting evidence">
            {observation.evidenceTransactionIds.map((transactionId) => (
              <button type="button" key={transactionId} onClick={() => onSelectTransaction(transactionId)} title={`Highlight ${transactionId}`}>
                {transactionId}
              </button>
            ))}
          </div>
        ) : <span className={styles.noEvidence}>No transaction ID cited</span>}
      </div>
    </article>
  )
}

function ResultList({ title, items, numbered = false }: { readonly title: string; readonly items: readonly string[]; readonly numbered?: boolean }) {
  if (items.length === 0) return null
  return (
    <div className={styles.resultBlock}>
      <div className={styles.resultBlockTitle}>{title}</div>
      <div className={`${styles.resultList} ${numbered ? styles.resultListNumbered : ''}`}>
        {items.map((item, index) => <div key={`${title}-${item}`} className={styles.resultListItem}><span>{numbered ? index + 1 : '•'}</span><p>{item}</p></div>)}
      </div>
    </div>
  )
}

function copyableText(result: AiAnalysisResult): string {
  return [
    `FINTRACE Gemini analysis: ${result.headline}`,
    result.summary,
    result.answer ? `Reviewer question answer:\n${result.answer}` : '',
    result.observations.length > 0 ? `Evidence observations:\n${result.observations.map((item) => `- ${item.title}: ${item.detail}${item.evidenceTransactionIds.length > 0 ? ` [${item.evidenceTransactionIds.join(', ')}]` : ''}`).join('\n')}` : '',
    result.nextSteps.length > 0 ? `Next review steps:\n${result.nextSteps.map((item) => `- ${item}`).join('\n')}` : '',
    result.caveats.length > 0 ? `Caveats:\n${result.caveats.map((item) => `- ${item}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n')
}

export function AiAnalyst({ context, onSelectTransaction }: AiAnalystProps) {
  const [question, setQuestion] = useState('')
  const [analysis, setAnalysis] = useState<AiAnalysisResult | undefined>()
  const [requestState, setRequestState] = useState<RequestState>('idle')
  const [error, setError] = useState<{ readonly message: string; readonly code?: string } | undefined>()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setQuestion('')
    setAnalysis(undefined)
    setRequestState('idle')
    setError(undefined)
    setCopyState('idle')
    requestRef.current?.abort()
    requestRef.current = null
  }, [context?.focalAccountId, context?.cutoffIso])

  useEffect(() => () => requestRef.current?.abort(), [])

  const runAnalysis = async (requestedQuestion: string) => {
    if (!context || requestState === 'loading') return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setRequestState('loading')
    setError(undefined)
    setCopyState('idle')
    try {
      const result = await requestGeminiAnalysis(context, requestedQuestion, controller.signal)
      if (controller.signal.aborted) return
      setAnalysis(result)
      setRequestState('success')
    } catch (caught: unknown) {
      if (controller.signal.aborted) return
      const requestError = caught instanceof AiAnalysisRequestError ? caught : undefined
      setError({ message: requestError?.message ?? 'Gemini analysis could not be completed.', code: requestError?.code })
      setRequestState('error')
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runAnalysis(question)
  }

  const handleCopy = async () => {
    if (!analysis) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(copyableText(analysis))
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1800)
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="ai-analyst-heading">
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className={styles.kicker}><Sparkles size={12} aria-hidden="true" /> Gemini copilot</div>
          <h2 id="ai-analyst-heading">AI case analysis</h2>
          <p>Ask for a concise, evidence-cited brief grounded in the current cutoff.</p>
        </div>
        <div className={styles.providerBadge}><span className={styles.providerDot} /> Gemini</div>
      </div>

      {context ? (
        <>
          <div className={styles.contextBar}>
            <span><ShieldCheck size={13} aria-hidden="true" /> Evidence locked</span>
            <span>{formatCount(context.relevantTransactions.length)} relevant rows</span>
            <span>{formatCount(context.evidenceTransactionIds.length)} cited IDs</span>
            <span>{context.cutoffIso ? formatTimestamp(Date.parse(context.cutoffIso)) : 'Before first transfer'}</span>
          </div>

          <form className={styles.askForm} onSubmit={handleSubmit}>
            <div className={styles.askInputWrap}>
              <MessageSquareText size={15} aria-hidden="true" />
              <label className="srOnly" htmlFor="ai-question">Ask Gemini about this case</label>
              <input
                id="ai-question"
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value.slice(0, 600))}
                placeholder="Ask Gemini about this case…"
                maxLength={600}
                disabled={requestState === 'loading'}
              />
              {question ? <span className={styles.questionCount}>{question.length}/600</span> : null}
            </div>
            <button type="submit" className={styles.askButton} disabled={requestState === 'loading'}>
              {requestState === 'loading' ? <LoaderCircle size={15} className={styles.spin} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
              <span>{requestState === 'loading' ? 'Analysing…' : analysis ? 'Ask again' : 'Analyse case'}</span>
            </button>
          </form>

          <div className={styles.quickQuestions} aria-label="Suggested Gemini questions">
            {quickQuestions.map((item) => <button type="button" key={item} onClick={() => { setQuestion(item); void runAnalysis(item) }} disabled={requestState === 'loading'}>{item}</button>)}
          </div>

          {requestState === 'error' && error ? (
            <div className={styles.errorBox} role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <div><strong>{error.code === 'not_configured' ? 'Gemini key required' : 'Gemini is temporarily unavailable'}</strong><p>{error.message}</p>{error.code === 'not_configured' ? <small>Add <code>GEMINI_API_KEY</code> to the Vercel environment, then redeploy.</small> : null}</div>
              <button type="button" onClick={() => void runAnalysis(question)} aria-label="Retry Gemini analysis"><RefreshCw size={15} aria-hidden="true" /></button>
            </div>
          ) : null}

          {requestState === 'idle' && !analysis ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><Sparkles size={18} aria-hidden="true" /></div>
              <strong>Turn the evidence into a reviewer brief</strong>
              <p>Gemini will explain the configured signals, cite visible transaction IDs, surface caveats, and suggest verification steps.</p>
            </div>
          ) : null}

          {requestState === 'loading' ? (
            <div className={styles.loadingState} role="status"><LoaderCircle size={17} className={styles.spin} /> Building a grounded Gemini brief…</div>
          ) : null}

          {analysis && requestState !== 'loading' ? (
            <div className={styles.result}>
              <div className={styles.resultHeader}>
                <div><span className={styles.resultKicker}>Gemini analysis · {analysis.model}</span><h3>{analysis.headline}</h3></div>
                <button type="button" className={styles.copyButton} onClick={() => void handleCopy()} title="Copy Gemini analysis">
                  {copyState === 'copied' ? <Check size={14} aria-hidden="true" /> : <Clipboard size={14} aria-hidden="true" />}
                  <span>{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy brief'}</span>
                </button>
              </div>
              <p className={styles.summary}>{analysis.summary}</p>
              {analysis.answer ? <div className={styles.answerBox}><span>Answer to your question</span><p>{analysis.answer}</p></div> : null}
              {analysis.observations.length > 0 ? (
                <div className={styles.observations}><div className={styles.resultBlockTitle}>Evidence observations</div>{analysis.observations.map((observation) => <ObservationCard key={`${observation.title}-${observation.detail}`} observation={observation} onSelectTransaction={onSelectTransaction} />)}</div>
              ) : null}
              <div className={styles.resultColumns}>
                <ResultList title="Next review steps" items={analysis.nextSteps} numbered />
                <ResultList title="Questions to verify" items={analysis.reviewQuestions} />
              </div>
              <ResultList title="Caveats" items={analysis.caveats} />
              <div className={styles.resultFooter}><span><ShieldCheck size={12} aria-hidden="true" /> Grounded to the supplied cutoff and evidence IDs</span><span>Generated {formatTimestamp(Date.parse(analysis.generatedAt))}</span></div>
            </div>
          ) : null}
        </>
      ) : (
        <div className={styles.noContext}><ShieldCheck size={17} aria-hidden="true" /><p>Select an account or load a dataset to activate Gemini case analysis.</p></div>
      )}
    </section>
  )
}
