import { marked } from 'marked'
import DOMPurify from 'dompurify'

export default function MarkdownRenderer({ content }) {
  const html = DOMPurify.sanitize(marked.parse(content ?? '', { breaks: true }))

  return (
    // eslint-disable-next-line react/no-danger
    <div className="text-[13px] leading-[1.5] text-text-primary [&_a]:text-accent [&_a]:underline" dangerouslySetInnerHTML={{ __html: html }} />
  )
}
