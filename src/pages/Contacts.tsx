import { t } from '../i18n'

interface ContactsProps {
  language: string
  onClose: () => void
}

export default function Contacts({ language, onClose }: ContactsProps) {
  return (
    <div className="legal-page">
      <button className="legal-close" onClick={onClose} aria-label={t('close', language)}>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="legal-content">
        <h1>{t('contactsTitle', language)}</h1>

        <h2>{t('contactsSupport', language)}</h2>
        <p>{t('contactsSupportDesc', language)}</p>
        <p><strong>Email:</strong> surf-messanger@mail.ru</p>

        <h2>{t('contactsCompany', language)}</h2>
        <p>{t('contactsCompanyDesc', language)}</p>
        <p>
          Покочуро Кирилл Евгеньевич<br />
          <strong>Статус:</strong> Самозанятый<br />
          <strong>ИНН:</strong> 540139406679<br />
          <strong>{t('contactsAddress', language)}:</strong> ул. Виталия Потылицина, д. 13/2, кв. 90
        </p>

        <h2>{t('contactsPayment', language)}</h2>
        <p>{t('contactsPaymentDesc', language)}</p>
        <p>
          <strong>{t('contactsPaymentAgent', language)}:</strong> ООО «НКО «ЮМани»<br />
          <strong>{t('contactsPaymentLicense', language)}:</strong> № 3537-К от 17.07.2024<br />
          <strong>{t('contactsPaymentSite', language)}:</strong> yookassa.ru
        </p>

        <h2>{t('contactsData', language)}</h2>
        <p>{t('contactsDataDesc', language)}</p>
        <p><strong>Email:</strong> surf-messanger@mail.ru</p>
      </div>
    </div>
  )
}
