'use client'

import React from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { cn } from '@/lib/utils'

interface SyntaxHighlighterProps {
  code: string
  language?: string
  className?: string
  showLineNumbers?: boolean
}

export function SyntaxHighlighter({
  code,
  language = 'javascript',
  className,
  showLineNumbers = true,
}: SyntaxHighlighterProps) {
  const detectedLanguage = detectLanguage(code, language)

  return (
    <Highlight
      theme={themes.nightOwl}
      code={code.trim()}
      language={detectedLanguage as any}
    >
      {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            'overflow-x-auto rounded-md border border-border bg-black/90 p-4 font-mono text-xs leading-relaxed',
            className,
            highlightClassName
          )}
          style={style}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })} className="table-row">
              {showLineNumbers && (
                <span className="table-cell pr-4 text-right select-none opacity-40 text-muted-foreground">
                  {i + 1}
                </span>
              )}
              <span className="table-cell">
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </span>
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  )
}

function detectLanguage(code: string, fallback: string): string {
  const trimmed = code.trim()

  // JSON detection
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) &&
      (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // Not valid JSON, continue detection
    }
  }

  // SQL detection
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/i.test(trimmed)) {
    return 'sql'
  }

  // Python detection
  if (/^(def|class|import|from|if __name__|@)\s/m.test(trimmed)) {
    return 'python'
  }

  // TypeScript detection
  if (/:\s*(string|number|boolean|any|void|interface|type)\b/.test(trimmed) ||
      /^(interface|type|enum)\s/m.test(trimmed)) {
    return 'typescript'
  }

  // JSX/TSX detection
  if (/<[A-Z][a-zA-Z0-9]*/.test(trimmed) || /<\/[a-z]+>/.test(trimmed)) {
    return 'jsx'
  }

  // Bash detection
  if (/^(#!\/bin\/bash|#!\/bin\/sh)/.test(trimmed) || /^(cd|ls|mkdir|rm|cat|grep|awk)\s/m.test(trimmed)) {
    return 'bash'
  }

  return fallback
}

export function CodeBlock({ children, language = 'text' }: { children: string; language?: string }) {
  return (
    <div className="my-4">
      <SyntaxHighlighter code={children} language={language} />
    </div>
  )
}
