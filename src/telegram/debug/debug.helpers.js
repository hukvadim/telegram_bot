import { getForwardInfo, getMediaInfo } from "../update.helpers.js";

export function buildDebugFull(update, msg, updateType) {
  const text = msg?.text || msg?.caption || "";
  const mediaInfo = getMediaInfo(msg);
  const forwardInfo = getForwardInfo(msg);

  return {
    updateType,
    updateId: update.update_id,

    updateKeys: Object.keys(update || {}),
    messageKeys: msg ? Object.keys(msg) : [],

    chat: getChatDebug(msg),
    sender: getSenderDebug(msg),

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

    replyToMessage: getReplyDebug(msg),

    ...mediaInfo,
    ...forwardInfo,

    rawMessage: msg,
    rawUpdate: update,
  };
}

export function buildDebugShort(debugFull) {
  return {
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
}

function getChatDebug(msg) {
  if (!msg?.chat) return null;

  return {
    id: msg.chat.id,
    type: msg.chat.type,
    title: msg.chat.title,
    username: msg.chat.username,
    first_name: msg.chat.first_name,
    last_name: msg.chat.last_name,
  };
}

function getSenderDebug(msg) {
  if (!msg?.from) return null;

  return {
    id: msg.from.id,
    is_bot: msg.from.is_bot,
    first_name: msg.from.first_name,
    last_name: msg.from.last_name,
    username: msg.from.username,
    language_code: msg.from.language_code,
  };
}

function getReplyDebug(msg) {
  if (!msg?.reply_to_message) return null;

  return {
    message_id: msg.reply_to_message.message_id,
    date: msg.reply_to_message.date,
    text: msg.reply_to_message.text || msg.reply_to_message.caption || "",
    chat: msg.reply_to_message.chat || null,
    from: msg.reply_to_message.from || null,
  };
}
