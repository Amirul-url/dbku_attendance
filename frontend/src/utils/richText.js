const ALLOWED_TAGS = new Set(['B', 'BR', 'DIV', 'LI', 'OL', 'P', 'STRONG', 'UL'])
const ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify'])

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''))
}

function isBoldStyle(source) {
  const fontWeight = source.style?.fontWeight?.toLowerCase()
  if (!fontWeight) return false
  if (fontWeight === 'bold' || fontWeight === 'bolder') return true
  const numericWeight = Number(fontWeight)
  return Number.isFinite(numericWeight) && numericWeight >= 600
}

function getTextAlign(source) {
  const textAlign = source.style?.textAlign?.toLowerCase()
  if (ALIGN_VALUES.has(textAlign)) return textAlign

  for (const className of Array.from(source.classList || [])) {
    const match = className.match(/^ql-align-(center|right|justify)$/)
    if (match) return match[1]
  }

  return ''
}

function flushList(lines, ordered) {
  const tag = ordered ? 'ol' : 'ul'
  return `<${tag}>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</${tag}>`
}

function plainTextToHtml(value) {
  const lines = String(value || '').split(/\r?\n/)
  const html = []
  let listItems = []
  let listType = ''

  function flushCurrentList() {
    if (!listItems.length) return
    html.push(flushList(listItems, listType === 'ol'))
    listItems = []
    listType = ''
  }

  lines.forEach((line) => {
    const bulletMatch = line.match(/^\s*[*-]\s+(.+)$/)
    const numberMatch = line.match(/^\s*\d+[.)]\s+(.+)$/)

    if (bulletMatch || numberMatch) {
      const nextType = numberMatch ? 'ol' : 'ul'
      if (listType && listType !== nextType) flushCurrentList()
      listType = nextType
      listItems.push((bulletMatch?.[1] || numberMatch?.[1] || '').trim())
      return
    }

    flushCurrentList()
    html.push(line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>')
  })

  flushCurrentList()
  return html.join('')
}

function sanitizeNode(node, doc) {
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent || '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return doc.createDocumentFragment()
  }

  const source = node
  const sourceTag = source.tagName.toUpperCase()
  const isStyledBold = sourceTag === 'SPAN' && isBoldStyle(source)

  if (!ALLOWED_TAGS.has(sourceTag) && !isStyledBold) {
    const fragment = doc.createDocumentFragment()
    Array.from(source.childNodes).forEach((child) => {
      fragment.appendChild(sanitizeNode(child, doc))
    })
    return fragment
  }

  const targetTag = sourceTag === 'B' || isStyledBold ? 'strong' : sourceTag.toLowerCase()
  const target = doc.createElement(targetTag)
  const textAlign = getTextAlign(source)

  if (ALIGN_VALUES.has(textAlign)) {
    target.style.textAlign = textAlign
  }

  if (sourceTag !== 'BR') {
    Array.from(source.childNodes).forEach((child) => {
      target.appendChild(sanitizeNode(child, doc))
    })
  }

  return target
}

export function sanitizeRichText(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const sourceHtml = looksLikeHtml(raw) ? raw : plainTextToHtml(raw)
  const doc = new DOMParser().parseFromString(`<div>${sourceHtml}</div>`, 'text/html')
  const cleanRoot = doc.createElement('div')

  Array.from(doc.body.firstElementChild?.childNodes || []).forEach((node) => {
    cleanRoot.appendChild(sanitizeNode(node, doc))
  })

  return cleanRoot.innerHTML.trim()
}

export function richTextToPlainText(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const doc = new DOMParser().parseFromString(sanitizeRichText(raw), 'text/html')
  return doc.body.textContent.replace(/\s+/g, ' ').trim()
}

export function richTextToPreview(value, options = {}) {
  const maxItems = options.maxItems || 2
  const maxItemLength = options.maxItemLength || 92
  const html = sanitizeRichText(value)
  if (!html) return { ordered: false, items: ['-'] }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const firstList = doc.body.querySelector('ol, ul')
  const sourceNodes = firstList
    ? Array.from(firstList.querySelectorAll(':scope > li'))
    : Array.from(doc.body.querySelectorAll('p')).filter((node) => node.textContent.trim())
  const ordered = firstList?.tagName === 'OL'
  const allItems = sourceNodes.length
    ? sourceNodes.map((node) => node.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean)
    : [doc.body.textContent.replace(/\s+/g, ' ').trim()].filter(Boolean)

  if (!allItems.length) return { ordered: false, items: ['-'] }

  const visibleItems = allItems.slice(0, maxItems)
  const hasHiddenItems = allItems.length > visibleItems.length
  const items = visibleItems.map((item, index) => {
    const isLastVisible = index === visibleItems.length - 1
    const shouldTruncate = item.length > maxItemLength || (isLastVisible && hasHiddenItems)
    if (!shouldTruncate) return item
    const suffix = '...'
    const clipped = item.length > maxItemLength ? item.slice(0, maxItemLength).trimEnd() : item
    return clipped.endsWith(suffix) ? clipped : `${clipped}${suffix}`
  })

  return { ordered, items }
}
