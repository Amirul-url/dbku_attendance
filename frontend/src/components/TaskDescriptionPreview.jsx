import { richTextToPreview } from '../utils/richText.js'

export function TaskDescriptionPreview({ value, className = '' }) {
  const preview = richTextToPreview(value)
  const ListTag = preview.ordered ? 'ol' : 'ul'

  return (
    <div className={`assignment-table-description ${className}`.trim()}>
      <ListTag>
        {preview.items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ListTag>
    </div>
  )
}
