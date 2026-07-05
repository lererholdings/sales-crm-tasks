import { useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer.jsx'

export default function MarkdownEditor({ value, onChange, placeholder, rows = 3 }) {
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div>
      <div className="mb-1 flex justify-end">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="text-[11px] text-text-secondary hover:text-text-primary"
        >
          {showPreview ? 'Edit' : 'Preview'}
        </button>
      </div>
      {showPreview ? (
        <div className="min-h-[60px] rounded-lg border border-border-mid bg-bg-input px-3 py-2">
          <MarkdownRenderer content={value} />
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full resize-none rounded-lg border border-border-mid bg-bg-input px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
        />
      )}
    </div>
  )
}
