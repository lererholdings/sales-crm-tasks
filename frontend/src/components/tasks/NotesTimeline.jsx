import { useState } from 'react'
import AddNoteForm from './AddNoteForm.jsx'
import LoadMoreButton from './LoadMoreButton.jsx'
import NoteItem from './NoteItem.jsx'

// notes is in ascending (oldest-first) order to match the timeline's visual
// order — see hooks/useTask.js. The last element is always the task's
// globally-latest note (the initial fetch is offset 0 in newest-first order,
// reversed), which is what the author + last-note edit rule cares about.
export default function NotesTimeline({ notes, notesTotal, currentUserId, onLoadMore, onAddNote, onEditNote }) {
  const [loadingMore, setLoadingMore] = useState(false)
  const remaining = notesTotal - notes.length
  const latestNoteId = notes[notes.length - 1]?.id

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
      <LoadMoreButton remaining={remaining} onClick={handleLoadMore} loading={loadingMore} />
      {notes.length === 0 && <p className="mb-3 text-[12px] text-text-muted">No notes yet.</p>}
      {notes.map((note) => (
        <NoteItem
          key={note.id}
          note={note}
          canEdit={note.id === latestNoteId && note.user?.id === currentUserId}
          onEdit={onEditNote}
        />
      ))}
      <AddNoteForm onAdd={onAddNote} />
    </div>
  )
}
