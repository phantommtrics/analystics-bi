import { useCallback, useMemo, useRef } from 'react'
import { highlightSql } from '../../lib/sqlHighlight'
import '../../styles/sql-editor.css'

interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
  minHeight?: string
}

export function SqlEditor({
  value,
  onChange,
  className = '',
  minHeight = '200px',
}: SqlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)

  const highlighted = useMemo(() => highlightSql(value), [value])

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current
    const highlight = highlightRef.current
    if (!textarea || !highlight) return
    highlight.scrollTop = textarea.scrollTop
    highlight.scrollLeft = textarea.scrollLeft
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Tab') return
      event.preventDefault()
      const textarea = event.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const next = `${value.slice(0, start)}  ${value.slice(end)}`
      onChange(next)
      requestAnimationFrame(() => {
        textarea.selectionStart = start + 2
        textarea.selectionEnd = start + 2
      })
    },
    [value, onChange],
  )

  return (
    <div
      className={`sql-editor relative min-h-0 flex-1 overflow-hidden font-mono text-sm leading-relaxed ${className}`}
      style={{ minHeight }}
    >
      <pre
        ref={highlightRef}
        aria-hidden
        className="sql-editor-highlight pointer-events-none absolute inset-0 m-0 overflow-auto whitespace-pre-wrap break-words p-0"
        dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className="sql-editor-input relative z-[1] m-0 block h-full min-h-[inherit] w-full resize-none overflow-auto whitespace-pre-wrap break-words border-0 bg-transparent p-0 text-transparent caret-[#aeafad] outline-none selection:bg-[#264f78] selection:text-transparent"
      />
    </div>
  )
}
