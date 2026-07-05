import { useCallback, useEffect, useState } from 'react'
import { useApiClient } from '../lib/apiClient.js'

const NOTES_PAGE_SIZE = 25

// The API returns notes newest-first (paginating by "load the next older
// batch"), but the timeline UI displays oldest-first (design.md's mockup).
// Reversing each fetched page and prepending older pages keeps the whole
// array in display order without the component needing to re-sort anything.
export function useTask(taskId) {
  const apiClient = useApiClient()
  const [task, setTask] = useState(null)
  const [notes, setNotes] = useState([])
  const [notesTotal, setNotesTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get(`/tasks/${taskId}?notes_limit=${NOTES_PAGE_SIZE}&notes_offset=0`)
      setTask(data)
      setNotes([...data.notes].reverse())
      setNotesTotal(data.notes_total)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [apiClient, taskId])

  useEffect(() => {
    load()
  }, [load])

  const loadMoreNotes = useCallback(async () => {
    if (!taskId) return
    const data = await apiClient.get(`/tasks/${taskId}/notes?limit=${NOTES_PAGE_SIZE}&offset=${notes.length}`)
    setNotes((prev) => [...[...data.notes].reverse(), ...prev])
    setNotesTotal(data.total)
  }, [apiClient, taskId, notes.length])

  const updateTask = useCallback(
    async (patch) => {
      const updated = await apiClient.patch(`/tasks/${taskId}`, patch)
      setTask(updated)
      return updated
    },
    [apiClient, taskId],
  )

  const addNote = useCallback(
    async (content) => {
      const note = await apiClient.post(`/tasks/${taskId}/notes`, { content })
      setNotes((prev) => [...prev, note])
      setNotesTotal((prev) => prev + 1)
      return note
    },
    [apiClient, taskId],
  )

  const editNote = useCallback(
    async (noteId, content) => {
      const updated = await apiClient.patch(`/tasks/${taskId}/notes/${noteId}`, { content })
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
      return updated
    },
    [apiClient, taskId],
  )

  return {
    task,
    notes,
    notesTotal,
    loading,
    error,
    reload: load,
    loadMoreNotes,
    updateTask,
    addNote,
    editNote,
  }
}
