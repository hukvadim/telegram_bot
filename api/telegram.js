const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const BOT_TOKEN = process.env.BOT_TOKEN

const TG_API = BOT_TOKEN
  ? `https://api.telegram.org/bot${BOT_TOKEN}`
  : ''

async function sendTelegramText(chatId, text) {
  if (!BOT_TOKEN || !chatId || !text) return

  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_notification: true
    })
  })
}

function getMainMessage(update = {}) {
  return (
    update.message ||
    update.channel_post ||
    null
  )
}

function getProfileId(msg = {}) {
  if (msg?.video?.file_unique_id) {
    return msg.video.file_unique_id
  }

  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    return msg.photo[0]?.file_unique_id || ''
  }

  return ''
}

function getProfileText(msg = {}) {
  return msg.caption || msg.text || ''
}

function buildProfileResponse(msg = {}) {
  const profileId = getProfileId(msg)
  const profileText = getProfileText(msg)

  if (!profileId) return ''

  return [
    `PROFILE_ID:${profileId}`,
    `PROFILE_TEXT:${profileText}`
  ].join('\n')
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

    const update = req.body

    if (
      update.edited_message ||
      update.edited_channel_post
    ) {
      return res.status(200).send('')
    }

    const msg = getMainMessage(update)

    const responseText = buildProfileResponse(msg)

    if (msg?.chat?.id && responseText) {
      await sendTelegramText(msg.chat.id, responseText)
    }

    return res.status(200).send(responseText)
  } catch (error) {
    console.error('TELEGRAM_ERROR:', error)

    return res.status(200).send('')
  }
}