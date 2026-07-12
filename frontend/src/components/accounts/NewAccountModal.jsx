import { useState } from 'react'

export default function NewAccountModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [acv, setAcv] = useState('')
  const [sfdcUrl, setSfdcUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !country) {
      setSubmitAttempted(true)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({
        name,
        country,
        acv: acv ? Number(acv) : undefined,
        sfdc_account_url: sfdcUrl || undefined,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-border bg-bg-surface p-5 shadow-xl">
        <h2 className="mb-4 text-[15px] font-medium text-text-primary">New account</h2>

        <label className="mb-3 block text-[12px] text-text-secondary">
          Name
          <input
            className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {submitAttempted && !name && <span className="mt-1 block text-[11px] text-urgent">Name is required.</span>}
        </label>

        <label className="mb-3 block text-[12px] text-text-secondary">
          Country
          <input
            className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          {submitAttempted && !country && (
            <span className="mt-1 block text-[11px] text-urgent">Country is required.</span>
          )}
        </label>

        <label className="mb-3 block text-[12px] text-text-secondary">
          ACV
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
            value={acv}
            onChange={(e) => setAcv(e.target.value)}
          />
        </label>

        <label className="mb-4 block text-[12px] text-text-secondary">
          SFDC account URL
          <input
            className="mt-1 w-full rounded-lg border border-border bg-bg-input px-3 py-1.5 text-[13px] text-text-primary"
            value={sfdcUrl}
            onChange={(e) => setSfdcUrl(e.target.value)}
          />
        </label>

        {error && <p className="mb-3 text-[12px] text-urgent">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-raised"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-accent-strong px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
