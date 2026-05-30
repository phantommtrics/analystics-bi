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
  const gutterRef = useRef<HTMLDivElement>(null)

  const highlighted = useMemo(() => highlightSql(value), [value])

  const lineCount = useMemo(() => Math.max(1, value.split('\n').length), [value])

  const lineNumbersText = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => String(i + 1)).join('\n'),
    [lineCount],
  )

  const gutterWidthCh = Math.max(2, String(lineCount).length) + 1.5

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current
    const highlight = highlightRef.current
    const gutter = gutterRef.current
    if (!textarea) return
    if (highlight) {
      highlight.scrollTop = textarea.scrollTop
      highlight.scrollLeft = textarea.scrollLeft
    }
    if (gutter) {
      gutter.scrollTop = textarea.scrollTop
    }
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
      className={`sql-editor flex min-h-0 flex-1 overflow-hidden font-mono text-sm leading-relaxed ${className}`}
      style={{ minHeight }}
    >
      <div
        ref={gutterRef}
        aria-hidden
        className="sql-editor-gutter shrink-0 overflow-hidden border-r border-[#3c3c3c] bg-[#1b1b1b] text-[#858585] select-none"
        style={{ width: `${gutterWidthCh}ch` }}
      >
        <pre className="m-0 px-2 py-0 text-right text-sm leading-relaxed">{lineNumbersText}</pre>
      </div>

      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <pre
          ref={highlightRef}
          aria-hidden
          className="sql-editor-highlight pointer-events-none absolute inset-0 m-0 overflow-auto whitespace-pre-wrap break-words px-3 py-0"
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
          className="sql-editor-input relative z-[1] m-0 block h-full min-h-[inherit] w-full resize-none overflow-auto whitespace-pre-wrap break-words border-0 bg-transparent px-3 py-0 text-transparent caret-[#aeafad] outline-none selection:bg-[#264f78] selection:text-transparent"
        />
      </div>
    </div>
  )
}
