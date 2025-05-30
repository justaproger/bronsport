// --- START OF FULL FILE frontend/src/pages/Info/FAQContent.jsx ---
import React from 'react';
import { useTranslation } from 'react-i18next';

// Компонент для одного вопроса-ответа
const FaqItem = ({ qKey, aKey, qDefault, aDefault }) => {
    const { t } = useTranslation();
    return (
        <div style={{ marginBottom: '1.5rem' }}>
            <p><strong>{t(qKey, qDefault)}</strong></p>
            <p>{t(aKey, aDefault)}</p>
        </div>
    );
};

const FAQContent = () => {
  const { t } = useTranslation(); // <-- Получаем t

  return (
    <>
      <h2>{t('info_faq.title', 'Часто Задаваемые Вопросы (ЧаВо)')}</h2>

      <h3 style={{ marginTop: '2rem' }}>{t('info_faq.section_general', 'Общие вопросы')}</h3>
      <FaqItem
          qKey="info_faq.general.q1" aKey="info_faq.general.a1"
          qDefault="В: Кто может пользоваться платформой?"
          aDefault="О: Платформой могут пользоваться студенты, сотрудники университетов-партнеров, а также все желающие."
      />
      <FaqItem
          qKey="info_faq.general.q2" aKey="info_faq.general.a2"
          qDefault="В: Нужно ли регистрироваться для просмотра объектов?"
          aDefault="О: Нет, просматривать каталог объектов и университетов можно без регистрации. Регистрация необходима для бронирования и оформления подписок."
      />

       <h3 style={{ marginTop: '2rem' }}>{t('info_faq.section_booking', 'Бронирование')}</h3>
       <FaqItem
          qKey="info_faq.booking.q1" aKey="info_faq.booking.a1"
          qDefault="В: Как забронировать объект?"
          aDefault='О: Найдите нужный объект в каталоге, перейдите на его страницу, выберите свободную дату и время в календаре, нажмите "Перейти к подтверждению" и следуйте инструкциям.'
          />
       <FaqItem
          qKey="info_faq.booking.q2" aKey="info_faq.booking.a2"
          qDefault="В: Можно ли отменить бронирование?"
          aDefault="О: На данный момент функция отмены бронирования пользователем не предусмотрена. По вопросам отмены обращайтесь в службу поддержки или к администрации спортивного объекта."
       />

       <h3 style={{ marginTop: '2rem' }}>{t('info_faq.section_subscription', 'Подписки')}</h3>
       <FaqItem
           qKey="info_faq.subscription.q1" aKey="info_faq.subscription.a1"
           qDefault="В: Что такое подписка (абонемент)?"
           aDefault="О: Подписка позволяет вам регулярно посещать выбранный объект в определенные дни недели и время в течение длительного периода (от 1 месяца)."
        />
       <FaqItem
           qKey="info_faq.subscription.q2" aKey="info_faq.subscription.a2"
           qDefault="В: Как оформить подписку?"
           aDefault='О: Найдите нужный объект в каталоге, перейдите на его страницу, выберите свободную дату и время в календаре, нажмите "Перейти к подтверждению" и следуйте инструкциям.'
           />

       <h3 style={{ marginTop: '2rem' }}>{t('info_faq.section_payment', 'Оплата')}</h3>
       <FaqItem
           qKey="info_faq.payment.q1" aKey="info_faq.payment.a1"
           qDefault="В: Какие способы оплаты доступны?"
           aDefault="О: В данный момент оплата симулируется. В будущем планируется интеграция с платежными системами UZCARD и HUMO."
        />
       <FaqItem
           qKey="info_faq.payment.q2" aKey="info_faq.payment.a2"
           qDefault="В: Что делать, если платеж не прошел?"
           aDefault="О: Убедитесь, что вы правильно ввели данные. Если проблема сохраняется, попробуйте позже или свяжитесь со службой поддержки."
        />

       {/* TODO: Добавить другие вопросы и ответы */}
       <p style={{ marginTop: '2rem', fontStyle: 'italic' }}>{t('info_faq.more_questions', 'Если у вас остались вопросы, свяжитесь с нами.')}</p>
    </>
  );
};

export default FAQContent;
// --- END OF FULL FILE ---