import { useState } from 'react'
import AssigneeChip from '../ui/AssigneeChip.jsx'
import MarkdownEditor from '../ui/MarkdownEditor.jsx'
import MarkdownRenderer from '../ui/MarkdownRenderer.jsx'

export default function NoteItem({ note, canEdit, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(note.content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const handleSave = async () => {
    if (!content.trim()) {
      setSubmitAttempted(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onEdit(note.id, content)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-3 border-b border-note-border pb-3 last:mb-0 last:border-0 last:pb-0">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <AssigneeChip user={note.user} size="lg" />
          <span className="text-[11px] text-text-muted">
            · {new Date(note.created_at).toLocaleDateString()}
            {note.edited_at ? ' (edited)' : ''}
          </span>
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] text-text-secondary hover:text-text-primary"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <MarkdownEditor value={content} onChange={setContent} rows={2} />
          {submitAttempted && !content.trim() && (
            <p className="mt-1 text-[11px] text-urgent">Note content is required.</p>
          )}
          {error && <p className="mt-1 text-[12px] text-urgent">{error}</p>}
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-accent-strong px-3 py-1 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setContent(note.content)
              }}
              className="rounded-lg px-3 py-1 text-[12px] text-text-secondary hover:bg-bg-raised"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <MarkdownRenderer content={note.content} />
      )}
    </div>
  )
}
