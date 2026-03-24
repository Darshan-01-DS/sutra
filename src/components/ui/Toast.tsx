'use client'
// src/components/ui/Toast.tsx

interface Toast { id: string; message: string; type: 'success' | 'error' | 'info' }

export function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (!toasts.length) return null
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => onRemove(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
