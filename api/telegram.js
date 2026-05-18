const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const TG_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : "";

function getMainMessage(update = {}) {
  return (
    update.message ||
    update.edited_message ||
    update.channel_post ||
    update.edited_channel_post ||
    null
  );
}

function getText(msg = {}) {
  return msg.text || msg.caption || "";
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function getPhotoUniqueIdsFromMessage(msg = {}) {
  if (!Array.isArray(msg.photo)) return [];

  return unique(msg.photo.map((photo) => photo.file_unique_id));
}

function getMainPhotoUniqueIdFromMessage(msg = {}) {
  if (!Array.isArray(msg.photo) || !msg.photo.length) return "";

  const biggestPhoto = [...msg.photo].sort((a, b) => {
    const aSize = (a.width || 0) * (a.height || 0);
    const bSize = (b.width || 0) * (b.height || 0);

    return bSize - aSize;
  })[0];

  return biggestPhoto?.file_unique_id || "";
}

function extractPhotoUniqueIdsFromText(text = "") {
  const cleanText = String(text).replace(/\\/g, "");
  const matches = cleanText.match(/AQ[A-Za-z0-9_-]{8,}/g) || [];

  return unique(matches);
}

function extractMainPhotoUniqueIdFromText(text = "") {
  const cleanText = String(text).replace(/\\/g, "");

  const match = cleanText.match(
    /["']?mainPhotoUniqueId["']?\s*:\s*["']?([A-Za-z0-9_-]+)/i
  );

  return match?.[1] || "";
}

function buildPhotoDebug(msg = {}) {
  const text = getText(msg);

  const photoUniqueIds =
    getPhotoUniqueIdsFromMessage(msg).length > 0
      ? getPhotoUniqueIdsFromMessage(msg)
      : extractPhotoUniqueIdsFromText(text);

  const mainPhotoUniqueId =
    getMainPhotoUniqueIdFromMessage(msg) ||
    extractMainPhotoUniqueIdFromText(text) ||
    photoUniqueIds.at(-1) ||
    "";

  return {
    photoUniqueIds,
    mainPhotoUniqueId,
  };
}

function isOnlyPhotoDebugText(text = "") {
  try {
    const data = JSON.parse(text);

    const keys = Object.keys(data || {});

    return (
      keys.length === 2 &&
      keys.includes("photoUniqueIds") &&
      keys.includes("mainPhotoUniqueId")
    );
  } catch {
    return false;
  }
}

async function sendTelegramJson(chatId, replyToMessageId, data) {
  if (!BOT_TOKEN || !chatId) return;

  const body = {
    chat_id: chatId,
    text: JSON.stringify(data, null, 2).slice(0, 3500),
    disable_notification: true,
    reply_parameters: {
      message_id: replyToMessageId,
      allow_sending_without_reply: true,
    },
  };

  const res = await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("TG_SEND_ERROR:", res.status, await res.text());
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({
        photoUniqueIds: [],
        mainPhotoUniqueId: "",
      });
    }

    const secretHeader = req.headers["x-telegram-bot-api-secret-token"];

    if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
      return res.status(403).json({
        error: "Invalid webhook secret",
      });
    }

    const msg = getMainMessage(req.body);
    console.log("msg: ", msg);
    const text = getText(msg);
    const photoDebug = buildPhotoDebug(msg);

    console.log("PHOTO_DEBUG:", JSON.stringify(photoDebug));

    if (msg?.chat?.id && !isOnlyPhotoDebugText(text)) {
      await sendTelegramJson(msg.chat.id, msg.message_id, photoDebug);
    }

    return res.status(200).json(photoDebug);
  } catch (error) {
    console.error("TELEGRAM_ERROR:", error);

    return res.status(200).json({
      photoUniqueIds: [],
      mainPhotoUniqueId: "",
    });
  }
}
