import crypto from "crypto";

const AI_CHECK_API = process.env.AI_CHECK_API;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

function hash(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

async function sendTelegramDebug(chatId, text) {
    if (!BOT_TOKEN || !chatId) return;

    try {
        await fetch(`${TG_API}/sendMessage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text.slice(0, 3500),
                disable_notification: true,
            }),
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

    return msg.photo.map((p) => p.file_unique_id).filter(Boolean);
}

function isProfileText(text = "") {
    const t = text.toLowerCase();

    return /ім['’`]?я\s*:/i.test(t) || /вік\s*:\s*\d+/i.test(t) || /місто\s*:/i.test(t);
}

function detectGroupType(chatTitle = "") {
    const t = chatTitle.toLowerCase();

    if (t.includes("normal")) return "normal";
    if (t.includes("spam")) return "spam";
    if (t.includes("taster")) return "taster";

    return "unknown";
}

function cleanProfileValue(value = "") {
	return String(value)
	  .toLowerCase()
	  .normalize("NFKC")
	  .replace(/[’`]/g, "'")
	  .replace(/ё/g, "е")
	  .replace(/[^\p{L}\p{N}\s:'-]/gu, " ")
	  .replace(/\s+/g, " ")
	  .trim();
  }
  
  function normalizeCity(city = "") {
	const c = cleanProfileValue(city);
  
	if (c === "киев" || c === "kiev" || c === "kyiv") return "київ";
  
	return c;
  }
  
  function getField(text = "", labels = []) {
	const lines = String(text)
	  .split("\n")
	  .map((line) => line.trim())
	  .filter(Boolean);
  
	for (const line of lines) {
	  for (const label of labels) {
		const re = new RegExp(`${label}\\s*:\\s*(.+)$`, "i");
		const match = line.match(re);
  
		if (match?.[1]) {
		  return match[1].trim();
		}
	  }
	}
  
	return "";
  }
  
  function getAbout(text = "") {
	const match = String(text).match(/(?:про себе|о себе)\s*:\s*([\s\S]+)/i);
	return match?.[1]?.trim() || "";
  }
  
  function getProfileBase(text = "") {
	const name = cleanProfileValue(
	  getField(text, ["ім['’`]?я", "имя", "name"])
	);
  
	const age = cleanProfileValue(
	  getField(text, ["вік", "возраст", "age"])
	);
  
	const city = normalizeCity(
	  getField(text, ["місто", "город", "city"])
	);
  
	const about = cleanProfileValue(getAbout(text));
  
	return [
	  `name:${name}`,
	  `age:${age}`,
	  `city:${city}`,
	  `about:${about}`
	].join("|");
  }
  
  function getMainPhotoUniqueId(msg) {
	if (!Array.isArray(msg?.photo) || !msg.photo.length) return "";
  
	// беремо найбільшу версію фото
	const biggest = [...msg.photo].sort((a, b) => {
	  const aSize = (a.width || 0) * (a.height || 0);
	  const bSize = (b.width || 0) * (b.height || 0);
	  return bSize - aSize;
	})[0];
  
	return biggest?.file_unique_id || "";
  }
  
  function buildProfileId(msg) {
	const text = getProfileText(msg);
	const profileBase = getProfileBase(text);
  
	const mainPhotoUniqueId = getMainPhotoUniqueId(msg);
	const allPhotoUniqueIds = getPhotoUniqueIds(msg);
  
	const origin = msg.forward_origin;
  
	// ✅ ГОЛОВНИЙ ID — тільки з анкети
	const profileId = `profile_${hash(profileBase)}`;
  
	// ✅ Допоміжний ID фото
	const mediaId = mainPhotoUniqueId
	  ? `media_${hash(mainPhotoUniqueId)}`
	  : null;
  
	// ✅ ID конкретного форварду, не для дубліката
	const sourceBase = [
	  origin?.type || "",
	  origin?.sender_user?.id || "",
	  origin?.sender_user?.username || "",
	  origin?.date || "",
	  msg.chat?.id || "",
	  msg.message_id || ""
	].join("|");
  
	const sourceId = `source_${hash(sourceBase)}`;
  
	return {
	  id: profileId,
	  profileId,
	  mediaId,
	  sourceId,
	  strategy: "profile_text_hash",
	  profileBase,
	  mainPhotoUniqueId,
	  allPhotoUniqueIds
	};
  }

async function saveProfile(profile) {
    if (!AI_CHECK_API) return null;

    const reaction = profile.groupType === "spam" ? "dislike" : profile.groupType === "normal" ? "like" : "none";

    const res = await fetch(`${AI_CHECK_API}/activity`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            profileId: profile.profileId,
            reaction,
            description: profile.description,
        }),
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
		profileId: stable.profileId,
		strategy: stable.strategy,

		mediaId: stable.mediaId,
		sourceId: stable.sourceId,

		groupType,

		chatId: chat.id,
		chatTitle: chat.title || "",

		messageId: msg.message_id,
		mediaGroupId: msg.media_group_id || null,

		text,
		profileBase: stable.profileBase,

		photoUniqueIds,
		mainPhotoUniqueId: stable.mainPhotoUniqueId,

		forwardOrigin: msg.forward_origin || null,

		description: [
			`group:${groupType}`,
			`chat:${chat.title || chat.id}`,
			`strategy:${stable.strategy}`,
			`profileId:${stable.profileId}`,
			`mediaId:${stable.mediaId || ""}`,
			`sourceId:${stable.sourceId || ""}`,
			`profileBase:${stable.profileBase}`,
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

        function cut(value, max = 1200) {
            if (value === null || value === undefined) return value;

            const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);

            return str.length > max ? str.slice(0, max) + "...[CUT]" : str;
        }

        function getUpdateType(update) {
            if (update.message) return "message";
            if (update.edited_message) return "edited_message";
            if (update.channel_post) return "channel_post";
            if (update.edited_channel_post) return "edited_channel_post";
            if (update.callback_query) return "callback_query";
            return "unknown";
        }

        function getMainMessage(update) {
            return update.message || update.edited_message || update.channel_post || update.edited_channel_post || update.callback_query?.message || null;
        }

        function getMediaInfo(msg) {
            return {
                hasPhoto: Array.isArray(msg?.photo),
                photoCount: msg?.photo?.length || 0,
                photos: (msg?.photo || []).map((p) => ({
                    file_id: p.file_id,
                    file_unique_id: p.file_unique_id,
                    width: p.width,
                    height: p.height,
                    file_size: p.file_size,
                })),

                hasVideo: !!msg?.video,
                video: msg?.video
                    ? {
                          file_id: msg.video.file_id,
                          file_unique_id: msg.video.file_unique_id,
                          width: msg.video.width,
                          height: msg.video.height,
                          duration: msg.video.duration,
                          file_name: msg.video.file_name,
                          mime_type: msg.video.mime_type,
                          file_size: msg.video.file_size,
                      }
                    : null,

                hasDocument: !!msg?.document,
                document: msg?.document
                    ? {
                          file_id: msg.document.file_id,
                          file_unique_id: msg.document.file_unique_id,
                          file_name: msg.document.file_name,
                          mime_type: msg.document.mime_type,
                          file_size: msg.document.file_size,
                      }
                    : null,

                hasAnimation: !!msg?.animation,
                animation: msg?.animation
                    ? {
                          file_id: msg.animation.file_id,
                          file_unique_id: msg.animation.file_unique_id,
                          file_name: msg.animation.file_name,
                          mime_type: msg.animation.mime_type,
                          file_size: msg.animation.file_size,
                      }
                    : null,
            };
        }

        function getForwardInfo(msg) {
            const origin = msg?.forward_origin || null;

            return {
                hasForwardOrigin: !!origin,
                forwardOriginType: origin?.type || null,

                forwardOrigin: origin,

                // старі/додаткові поля, якщо Telegram їх раптом дасть
                forwardFrom: msg?.forward_from || null,
                forwardFromChat: msg?.forward_from_chat || null,
                forwardFromMessageId: msg?.forward_from_message_id || null,
                forwardSignature: msg?.forward_signature || null,
                forwardSenderName: msg?.forward_sender_name || null,
                forwardDate: msg?.forward_date || null,
            };
        }

        const updateType = getUpdateType(update);
        const msg = getMainMessage(update);

        const text = msg?.text || msg?.caption || "";

        const mediaInfo = getMediaInfo(msg);
        const forwardInfo = getForwardInfo(msg);

        const debugFull = {
            updateType,
            updateId: update.update_id,

            updateKeys: Object.keys(update || {}),
            messageKeys: msg ? Object.keys(msg) : [],

            chat: msg?.chat
                ? {
                      id: msg.chat.id,
                      type: msg.chat.type,
                      title: msg.chat.title,
                      username: msg.chat.username,
                      first_name: msg.chat.first_name,
                      last_name: msg.chat.last_name,
                  }
                : null,

            sender: msg?.from
                ? {
                      id: msg.from.id,
                      is_bot: msg.from.is_bot,
                      first_name: msg.from.first_name,
                      last_name: msg.from.last_name,
                      username: msg.from.username,
                      language_code: msg.from.language_code,
                  }
                : null,

            senderChat: msg?.sender_chat || null,
            authorSignature: msg?.author_signature || null,

            messageId: msg?.message_id,
            messageThreadId: msg?.message_thread_id || null,
            date: msg?.date || null,

            mediaGroupId: msg?.media_group_id || null,

            hasText: !!text,
            textLength: text.length,
            text,
            textPreview: text.slice(0, 500),

            caption: msg?.caption || null,
            captionEntities: msg?.caption_entities || [],
            entities: msg?.entities || [],

            replyToMessage: msg?.reply_to_message
                ? {
                      message_id: msg.reply_to_message.message_id,
                      date: msg.reply_to_message.date,
                      text: msg.reply_to_message.text || msg.reply_to_message.caption || "",
                      chat: msg.reply_to_message.chat || null,
                      from: msg.reply_to_message.from || null,
                  }
                : null,

            ...mediaInfo,
            ...forwardInfo,

            rawMessage: msg,
            rawUpdate: update,
        };

        const debugShort = {
            updateType: debugFull.updateType,
            updateId: debugFull.updateId,

            chatId: debugFull.chat?.id,
            chatType: debugFull.chat?.type,
            chatTitle: debugFull.chat?.title,

            messageId: debugFull.messageId,
            mediaGroupId: debugFull.mediaGroupId,
            date: debugFull.date,

            hasText: debugFull.hasText,
            textLength: debugFull.textLength,
            textPreview: debugFull.textPreview,

            photoCount: debugFull.photoCount,
            photoUniqueIds: debugFull.photos.map((p) => p.file_unique_id),

            hasForwardOrigin: debugFull.hasForwardOrigin,
            forwardOriginType: debugFull.forwardOriginType,
            forwardOrigin: debugFull.forwardOrigin,
        };

        // 🔥 Повна інформація у Vercel Logs
        console.error("TG_DEBUG_FULL:", JSON.stringify(debugFull, null, 2));

        // 🔥 Коротка інформація прямо в Telegram
        if (msg?.chat?.id && !text.startsWith("BOT DEBUG")) {
            await sendTelegramDebug(msg.chat.id, `BOT DEBUG SHORT\n\n${cut(debugShort, 3500)}`);
        }

        if (msg && !text.startsWith("BOT DEBUG")) {
            await handleMessage(msg);
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
