import crypto from "crypto";

const AI_CHECK_API = process.env.AI_CHECK_API;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

function hash(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex")
    .slice(0, 16);
}

async function sendTelegramDebug(chatId, text) {
	if (!BOT_TOKEN || !chatId) return;
  
	try {
	  await fetch(`${TG_API}/sendMessage`, {
		method: "POST",
		headers: {
		  "Content-Type": "application/json"
		},
		body: JSON.stringify({
		  chat_id: chatId,
		  text: text.slice(0, 3500),
		  disable_notification: true
		})
	  });
	} catch (e) {
	  console.error("DEBUG SEND ERROR:", e.message);
	}
  }
  
function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s:'|-]/gu, "")
    .trim();
}

function getProfileText(msg) {
  return msg.text || msg.caption || "";
}

function getPhotoUniqueIds(msg) {
  if (!Array.isArray(msg.photo)) return [];

  return msg.photo
    .map((p) => p.file_unique_id)
    .filter(Boolean);
}

function isProfileText(text = "") {
  const t = text.toLowerCase();

  return (
    /ім['’`]?я\s*:/i.test(t) ||
    /вік\s*:\s*\d+/i.test(t) ||
    /місто\s*:/i.test(t)
  );
}

function detectGroupType(chatTitle = "") {
  const t = chatTitle.toLowerCase();

  if (t.includes("normal")) return "normal";
  if (t.includes("spam")) return "spam";
  if (t.includes("taster")) return "taster";

  return "unknown";
}

function buildProfileId(msg) {
  const text = getProfileText(msg);
  const normalizedText = normalizeText(text);
  const photoIds = getPhotoUniqueIds(msg);
  const origin = msg.forward_origin;

  // Найкращий варіант: Telegram дав origin channel + original message_id
  if (origin?.type === "channel" && origin?.chat?.id && origin?.message_id) {
    return {
      id: `tg_channel_${origin.chat.id}_${origin.message_id}`,
      strategy: "forward_origin_channel"
    };
  }

  // Якщо origin є, але без message_id
  if (origin?.type) {
    const base = [
      origin.type,
      origin.date || "",
      origin.sender_user?.id || "",
      origin.sender_user_name || "",
      origin.sender_chat?.id || "",
      normalizedText,
      photoIds.join("_")
    ].join("|");

    return {
      id: `tg_origin_${hash(base)}`,
      strategy: "forward_origin_fallback"
    };
  }

  // Fallback: текст анкети + фото
  const fallbackBase = [
    normalizedText,
    photoIds.join("_")
  ].join("|");

  return {
    id: `profile_${hash(fallbackBase)}`,
    strategy: "text_photo_fallback"
  };
}

async function saveProfile(profile) {
  if (!AI_CHECK_API) return null;

  const reaction =
    profile.groupType === "spam"
      ? "dislike"
      : profile.groupType === "normal"
        ? "like"
        : "none";

  const res = await fetch(`${AI_CHECK_API}/activity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      profileId: profile.profileId,
      reaction,
      description: profile.description
    })
  });

  if (!res.ok) {
    console.error("AI_CHECK save error:", res.status);
    return null;
  }

  return res.json();
}

async function handleMessage(msg) {
  const chat = msg.chat || {};
  const text = getProfileText(msg);
  const photoUniqueIds = getPhotoUniqueIds(msg);
  const groupType = detectGroupType(chat.title || "");

  // Поки зберігаємо тільки анкети
  if (!isProfileText(text) && !photoUniqueIds.length) {
    console.log("skip non-profile message");
    return;
  }

  const stable = buildProfileId(msg);

  const profile = {
    profileId: stable.id,
    strategy: stable.strategy,

    groupType,

    chatId: chat.id,
    chatTitle: chat.title || "",

    messageId: msg.message_id,
    mediaGroupId: msg.media_group_id || null,

    text,
    photoUniqueIds,

    forwardOrigin: msg.forward_origin || null,

    description: [
      `group:${groupType}`,
      `chat:${chat.title || chat.id}`,
      `strategy:${stable.strategy}`,
      `text:${normalizeText(text)}`,
      `photos:${photoUniqueIds.join(",")}`
    ].join("|")
  };

  console.log("NEW PROFILE:");
  console.log(JSON.stringify(profile, null, 2));

  await saveProfile(profile);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({
        ok: true,
        message: "Telegram webhook is alive"
      });
    }

    const secretHeader = req.headers["x-telegram-bot-api-secret-token"];

    if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
      return res.status(403).json({
        ok: false,
        error: "Invalid webhook secret"
      });
    }

	const update = req.body;

	const updateType =
	update.message
		? "message"
		: update.channel_post
		? "channel_post"
		: update.edited_channel_post
			? "edited_channel_post"
			: "unknown";

	const msg =
	update.message ||
	update.channel_post ||
	update.edited_channel_post;

	const text = msg?.text || msg?.caption || "";

	const debug = {
	updateType,
	chatId: msg?.chat?.id,
	chatTitle: msg?.chat?.title,
	messageId: msg?.message_id,
	hasText: !!text,
	textPreview: text.slice(0, 300),
	hasPhoto: Array.isArray(msg?.photo),
	photoCount: msg?.photo?.length || 0,
	hasForwardOrigin: !!msg?.forward_origin,
	forwardOrigin: msg?.forward_origin || null
	};

	// 🔥 буде видно, якщо поставити фільтр Error
	console.error("TG_DEBUG:", JSON.stringify(debug, null, 2));

	// щоб не було безкінечного циклу від debug-повідомлень
	if (msg?.chat?.id && !text.startsWith("BOT DEBUG")) {
	await sendTelegramDebug(
		msg.chat.id,
		`BOT DEBUG\n\n${JSON.stringify(debug, null, 2)}`
	);
	}

	if (msg && !text.startsWith("BOT DEBUG")) {
	await handleMessage(msg);
	}

	return res.status(200).json({ ok: true, updateType });
  } catch (error) {
    console.error("telegram webhook error:", error);

    return res.status(200).json({
      ok: false,
      error: error.message
    });
  }
}