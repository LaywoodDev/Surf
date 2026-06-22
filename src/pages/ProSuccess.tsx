import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { CheckCircle, XCircle } from 'lucide-react'

interface ProSuccessProps {
  language: string
  onClose: () => void
}

function getInitialStatus(): 'loading' | 'success' | 'error' {
  const params = new URLSearchParams(window.location.search)
  if (params.get('payment_id') || params.get('plan_id')) {
    return 'loading'
  }
  return 'error'
}

export default function ProSuccess({ language, onClose }: ProSuccessProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(getInitialStatus)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paymentId = params.get('payment_id')
    if (!paymentId) return

    const token = localStorage.getItem('token')
    fetch('/api/subscription/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ payment_id: paymentId }),
    })
      .then(r => r.json())
      .then(data => {
        setStatus(data.status === 'active' ? 'success' : 'error')
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="pro-success-page">
      <div className="pro-success-card">
        {status === 'loading' && (
          <>
            <div className="pro-success-spinner" />
            <h2>{t('processingPayment', language)}</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={64} className="pro-success-icon" />
            <h2>{t('paymentSuccess', language)}</h2>
            <p>{t('paymentSuccessDesc', language)}</p>
            <button className="pro-success-btn" onClick={onClose}>
              {t('goToApp', language)}
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={64} className="pro-error-icon" />
            <h2>{t('paymentError', language)}</h2>
            <p>{t('paymentErrorDesc', language)}</p>
            <button className="pro-success-btn" onClick={onClose}>
              {t('goToApp', language)}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
