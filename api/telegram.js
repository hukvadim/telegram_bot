const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const BOT_TOKEN = process.env.BOT_TOKEN
const TG_API = BOT_TOKEN
  ? `https://api.telegram.org/bot${BOT_TOKEN}`
  : ''

async function sendTelegramText(chatId, text) {
  if (!BOT_TOKEN || !chatId) return

  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  })
}

function getMainMessage(update = {}) {
  return (
    update.message ||
    update.edited_message ||
    update.channel_post ||
    update.edited_channel_post ||
    null
  )
}

function getProfileId(msg = {}) {
  // VIDEO
  if (msg?.video?.file_unique_id) {
    return msg.video.file_unique_id
  }

  // PHOTO
  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    return msg.photo[0]?.file_unique_id || ''
  }

  return ''
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(200).send('')
    }

    const secretHeader =
      req.headers['x-telegram-bot-api-secret-token']

    if (
      WEBHOOK_SECRET &&
      secretHeader !== WEBHOOK_SECRET
    ) {
      return res.status(403).send('forbidden')
    }

    const msg = getMainMessage(req.body)

    const profileId = getProfileId(msg)

    if (msg?.chat?.id && profileId) {
      await sendTelegramText(msg.chat.id, profileId)
    }

    return res.status(200).send(profileId)
  } catch (error) {
    console.error('TELEGRAM_ERROR:', error)

    return res.status(200).send('')
  }
}