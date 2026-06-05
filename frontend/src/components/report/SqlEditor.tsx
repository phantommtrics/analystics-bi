import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react'
import { highlightSql } from '../../lib/sqlHighlight'
import '../../styles/sql-editor.css'

export interface SqlEditorHandle {
  focusAtStart: () => void
}

interface SqlEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
  minHeight?: string
  /** Fixed visible line count; editor scrolls internally beyond this height. */
  visibleLines?: number
}

const LINE_HEIGHT_PX = 22

function countEditorLines(text: string): number {
  if (text.length === 0) return 1
  return text.split('\n').length
}

export const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(function SqlEditor(
  { value, onChange, className = '', minHeight = '200px', visibleLines },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const highlighted = useMemo(() => highlightSql(value), [value])
  const lineCount = useMemo(() => countEditorLines(value), [value])

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

  const focusAtStart = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(0, 0)
    textarea.scrollTop = 0
    textarea.scrollLeft = 0
    syncScroll()
  }, [syncScroll])

  useImperativeHandle(ref, () => ({ focusAtStart }), [focusAtStart])

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

  const fixedHeightStyle =
    visibleLines != null && visibleLines > 0
      ? {
          height: `${visibleLines * LINE_HEIGHT_PX}px`,
          minHeight: `${visibleLines * LINE_HEIGHT_PX}px`,
          maxHeight: `${visibleLines * LINE_HEIGHT_PX}px`,
        }
      : undefined

  return (
    <div
      className={`sql-editor flex overflow-hidden ${visibleLines ? 'shrink-0' : 'min-h-0 flex-1'} ${className}`}
      style={fixedHeightStyle ?? { minHeight }}
    >
      <div
        ref={gutterRef}
        aria-hidden
        className="sql-editor-gutter shrink-0 overflow-hidden border-r border-[#3c3c3c] bg-[#1b1b1b] text-[#858585] select-none"
        style={{ width: `${gutterWidthCh}ch` }}
      >
        <pre className="sql-editor-code-layer text-right text-[#858585]">{lineNumbersText}</pre>
      </div>

      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <pre
          ref={highlightRef}
          aria-hidden
          className="sql-editor-highlight sql-editor-code-layer pointer-events-none absolute inset-0 overflow-auto"
          dangerouslySetInnerHTML={{ __html: highlighted }}
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
          wrap="off"
          className="sql-editor-input relative z-[1] block h-full min-h-0 w-full resize-none overflow-auto border-0 bg-transparent caret-[#aeafad] outline-none selection:bg-[#264f78]"
        />
      </div>
    </div>
  )
})
