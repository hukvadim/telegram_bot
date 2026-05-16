# Telegram webhook refactor

Головне правило: якщо файл стає більший за 200 рядків, логіку треба винести в окремий модуль.

## Структура

```txt
api/
  telegram.js
  setupWebhook.js

src/
  telegram/
    env.js
    telegram.client.js
    update.helpers.js
    debug/
      debug.helpers.js
    profile/
      profile.text.js
      profile.id.js
      profile.service.js
```

## Що змінилось

- `api/telegram.js` тепер тільки приймає webhook і викликає сервіси.
- Debug-логіка винесена в `src/telegram/debug/debug.helpers.js`.
- Telegram sendMessage винесено в `src/telegram/telegram.client.js`.
- Робота з update/message винесена в `src/telegram/update.helpers.js`.
- Логіка анкети, ID і збереження винесені в `src/telegram/profile/*`.

## Перевірка

```bash
npm run dev
```

Після деплою:

```bash
npm run deploy
```

Потім знову викликати:

```txt
/api/setupWebhook?key=YOUR_SETUP_KEY
```
