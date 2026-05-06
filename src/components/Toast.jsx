import { useEffect, useState } from 'react'

export default function Toast({ message }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return undefined
    }
    const show = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(show)
  }, [message])

  if (!message) return null

  return (
    <>
      <style>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translate3d(0, 12px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        .toast-host {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          max-width: min(340px, calc(100vw - 32px));
          padding: 14px 18px;
          border-radius: 10px;
          background: var(--card-cream, #fbf8f1);
          color: var(--navy, #0a1628);
          border: 0.5px solid var(--card-border, #e8dfcc);
          box-shadow:
            0 4px 6px rgba(10, 22, 40, 0.06),
            0 22px 40px rgba(10, 22, 40, 0.14);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
          pointer-events: none;
          opacity: 0;
          transform: translate3d(0, 12px, 0);
        }
        .toast-host.toast-host--visible {
          animation: toast-in 340ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>
      <div className={`toast-host${visible ? ' toast-host--visible' : ''}`} role="status" aria-live="polite">
        {message}
      </div>
    </>
  )
}
