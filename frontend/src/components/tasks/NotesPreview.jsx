function formatRelativeShort(dateStr) {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'today'
  return `${diffDays}d`
}

// Notes come back newest-first from GET /api/tasks (matches this component's
// use in the table row — most recent activity first). Each note is its own
// line rather than run together on one row (per review feedback).
export default function NotesPreview({ notes }) {
  if (!notes || notes.length === 0) return <span className="text-[11px] text-text-muted">—</span>

  return (
    <div className="max-w-[220px] text-[11px] text-text-secondary" title={notes.map((n) => n.content).join('\n')}>
      {notes.map((note) => (
        <div key={note.id} className="truncate">
          <span className="text-text-muted">{formatRelativeShort(note.created_at)}: </span>
          {note.content}
        </div>
      ))}
    </div>
  )
}
