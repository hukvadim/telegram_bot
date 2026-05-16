import { BOT_TOKEN, TG_API } from "./env.js";

export async function sendTelegramDebug(chatId, replyToMessageId, text) {
  if (!BOT_TOKEN || !chatId) return;

  const body = {
    chat_id: chatId,
    text: text.slice(0, 3500),
    disable_notification: true,
    reply_parameters: {
      message_id: replyToMessageId,
      allow_sending_without_reply: true,
    },
  };

  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("DEBUG SEND ERROR:", res.status, await res.text());
    }
  } catch (error) {
    console.error("DEBUG SEND ERROR:", error.message);
  }
}
