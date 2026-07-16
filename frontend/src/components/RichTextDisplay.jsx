import { sanitizeRichText } from '../utils/richText.js'

export function RichTextDisplay({ value, className = '' }) {
  const html = sanitizeRichText(value || '-')

  return (
    <div
      className={`rich-text-display ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
