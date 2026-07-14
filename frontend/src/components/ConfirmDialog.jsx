import { useCallback, useRef, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

export function useConfirmDialog() {
  const resolverRef = useRef(null)
  const [options, setOptions] = useState(null)

  const close = useCallback((result) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setOptions(null)
  }, [])

  const confirm = useCallback((nextOptions = {}) => new Promise((resolve) => {
    resolverRef.current = resolve
    setOptions({
      title: 'Confirm Delete',
      message: 'Are you sure you want to delete this record?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      ...nextOptions,
    })
  }), [])

  const dialog = options ? (
    <div className="modal-overlay open confirm-dialog-overlay" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="modal-box confirm-dialog-box">
        <div className="confirm-dialog-icon"><AlertTriangle size={26} /></div>
        <div className="confirm-dialog-content">
          <h2 id="confirm-dialog-title">{options.title}</h2>
          <p>{options.message}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={() => close(false)}>{options.cancelLabel}</button>
          <button type="button" className="btn btn-red" onClick={() => close(true)}><Trash2 size={16} /> {options.confirmLabel}</button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, confirmDialog: dialog }
}
