// --- START OF FULL FILE frontend/src/pages/Info/ContactContent.jsx ---
import React from 'react';
import { useTranslation } from 'react-i18next';

const ContactContent = () => {
  const { t } = useTranslation(); // <-- Получаем t

  // TODO: Добавить реальную форму обратной связи
  const handleFormSubmit = (e) => {
    e.preventDefault();
    alert(t('info_contact.form_submit_placeholder', 'Форма пока не работает :)'));
  };

  return (
    <>
      <h2>{t('info_contact.title', 'Контакты')}</h2>
      <p>{t('info_contact.intro', 'Если у вас есть вопросы, предложения или проблемы, пожалуйста, свяжитесь с нами удобным для вас способом.')}</p>

      <h3>{t('info_contact.support_title', 'Служба поддержки:')}</h3>
      <ul>
        <li><strong>{t('info_contact.support_phone_label', 'Телефон:')}</strong> <a href="tel:+998993748277">+998 99 374 82 77</a></li>
        <li><strong>{t('info_contact.support_email_label', 'Email:')}</strong> <a href="mailto:main.teamx@gmail.com">main.teamx@gmail.com</a></li>
        <li><strong>{t('info_contact.support_telegram_label', 'Telegram:')}</strong> <a href="https://t.me/bronsport_support" target="_blank" rel="noopener noreferrer">@bronsport_support</a></li>
      </ul>

      <h3>{t('info_contact.address_title', 'Адрес офиса :')}</h3>
      <p>
        {t('info_contact.address_line1', 'г. Ташкент, ул. Университетская, 1')}<br />
        {t('info_contact.address_line2', 'Режим работы: Пн-Пт, 9:00 - 18:00')}
      </p>

       <h3>{t('info_contact.form_title', 'Форма обратной связи:')}</h3>
       {/* Заглушка формы */}
       <form onSubmit={handleFormSubmit} style={{ marginTop: '1rem', border: '1px dashed #ccc', padding: '1rem', borderRadius: '8px' }}>
           <p style={{ fontStyle: 'italic', color: '#5f6368' }}>{t('info_contact.form_placeholder', '(Здесь будет форма для отправки сообщений...)')}</p>
           <button type="submit" style={{ marginTop: '1rem', padding: '8px 15px', cursor: 'pointer' }}>{t('info_contact.form_send_button', 'Отправить (Тест)')}</button>
       </form>
    </>
  );
};

export default ContactContent;
// --- END OF FULL FILE ---