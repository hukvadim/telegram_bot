import { WEBHOOK_SECRET } from "../src/telegram/env.js";
import { buildDebugFull, buildDebugShort } from "../src/telegram/debug/debug.helpers.js";
import { sendTelegramDebug } from "../src/telegram/telegram.client.js";
import { cut, getMainMessage, getUpdateType } from "../src/telegram/update.helpers.js";
import { handleProfileMessage } from "../src/telegram/profile/profile.service.js";

function isBotDebug(text = "") {
  return text.startsWith("BOT DEBUG");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true,
        message: "Telegram webhook is alive",
      });
    }

    const secretHeader = req.headers["x-telegram-bot-api-secret-token"];

    if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
      return res.status(403).json({
        ok: false,
        error: "Invalid webhook secret",
      });
    }

    const update = req.body;
    const updateType = getUpdateType(update);
    const msg = getMainMessage(update);
    const text = msg?.text || msg?.caption || "";

    const debugFull = buildDebugFull(update, msg, updateType);
    const debugShort = buildDebugShort(debugFull);

    console.error("TG_DEBUG_FULL:", JSON.stringify(debugFull, null, 2));

    if (msg?.chat?.id && !isBotDebug(text)) {
      await sendTelegramDebug(
        msg.chat.id,
        msg.message_id,
        `BOT DEBUG SHORT\n\n${cut(debugShort, 3500)}`
      );
    }

    if (msg && !isBotDebug(text)) {
      await handleProfileMessage(msg);
    }

    return res.status(200).json({
      ok: true,
      updateType,
      chatId: msg?.chat?.id || null,
      messageId: msg?.message_id || null,
    });
  } catch (error) {
    console.error("telegram webhook error:", error);

    return res.status(200).json({
      ok: false,
      error: error.message,
    });
  }
}
