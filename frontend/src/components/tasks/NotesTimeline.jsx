import { useState } from 'react'
import AddNoteForm from './AddNoteForm.jsx'
import LoadMoreButton from './LoadMoreButton.jsx'
import NoteItem from './NoteItem.jsx'

// notes is newest-first (per review feedback, overriding design.md's
// original oldest-first mockup) — see hooks/useTask.js. The add-note field
// sits above the list; the first element is always the task's
// globally-latest note, which is what the author + last-note edit rule
// cares about. The list itself scrolls independently (fixed max-height)
// rather than growing the whole side panel.
export default function NotesTimeline({ notes, notesTotal, currentUserId, onLoadMore, onAddNote, onEditNote }) {
  const [loadingMore, setLoadingMore] = useState(false)
  const remaining = notesTotal - notes.length
  const latestNoteId = notes[0]?.id

  const handleLoadMore = async () => {
    setLoadingMore(true)
    try {
      await onLoadMore()
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="flex-1 p-4">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">Notes</p>
      <AddNoteForm onAdd={onAddNote} />
      <div className="mt-3 max-h-96 overflow-y-auto border-t border-border pt-3">
        {notes.length === 0 && <p className="text-[12px] text-text-muted">No notes yet.</p>}
        {notes.map((note) => (
          <NoteItem
            key={note.id}
            note={note}
            canEdit={note.id === latestNoteId && note.user?.id === currentUserId}
            onEdit={onEditNote}
          />
        ))}
        <LoadMoreButton remaining={remaining} onClick={handleLoadMore} loading={loadingMore} />
      </div>
    </div>
  )
}
