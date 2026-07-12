import { useState } from 'react'
import MarkdownEditor from '../ui/MarkdownEditor.jsx'

export default function AddNoteForm({ onAdd }) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const handlePost = async () => {
    if (!content.trim()) {
      setSubmitAttempted(true)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onAdd(content)
      setContent('')
      setSubmitAttempted(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <MarkdownEditor value={content} onChange={setContent} placeholder="Add a note… (markdown supported)" />
      {submitAttempted && !content.trim() && (
        <p className="mt-1 text-[11px] text-urgent">Note content is required.</p>
      )}
      {error && <p className="mt-1 text-[12px] text-urgent">{error}</p>}
      <button
        type="button"
        onClick={handlePost}
        disabled={submitting}
        className="mt-1.5 rounded-lg bg-accent-strong px-3.5 py-1 text-[12px] font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'Posting…' : 'Post note'}
      </button>
    </div>
  )
}
