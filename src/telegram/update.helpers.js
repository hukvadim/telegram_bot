export function cut(value, max = 1200) {
  if (value === null || value === undefined) return value;

  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return str.length > max ? `${str.slice(0, max)}...[CUT]` : str;
}

export function getUpdateType(update = {}) {
  if (update.message) return "message";
  if (update.edited_message) return "edited_message";
  if (update.channel_post) return "channel_post";
  if (update.edited_channel_post) return "edited_channel_post";
  if (update.callback_query) return "callback_query";

  return "unknown";
}

export function getMainMessage(update = {}) {
  return (
    update.message ||
    update.edited_message ||
    update.channel_post ||
    update.edited_channel_post ||
    update.callback_query?.message ||
    null
  );
}

export function getMediaInfo(msg) {
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
    video: normalizeFileMedia(msg?.video, ["width", "height", "duration"]),

    hasDocument: !!msg?.document,
    document: normalizeFileMedia(msg?.document),

    hasAnimation: !!msg?.animation,
    animation: normalizeFileMedia(msg?.animation),
  };
}

export function getForwardInfo(msg) {
  const origin = msg?.forward_origin || null;

  return {
    hasForwardOrigin: !!origin,
    forwardOriginType: origin?.type || null,
    forwardOrigin: origin,

    forwardFrom: msg?.forward_from || null,
    forwardFromChat: msg?.forward_from_chat || null,
    forwardFromMessageId: msg?.forward_from_message_id || null,
    forwardSignature: msg?.forward_signature || null,
    forwardSenderName: msg?.forward_sender_name || null,
    forwardDate: msg?.forward_date || null,
  };
}

function normalizeFileMedia(media, extraKeys = []) {
  if (!media) return null;

  const base = {
    file_id: media.file_id,
    file_unique_id: media.file_unique_id,
    file_name: media.file_name,
    mime_type: media.mime_type,
    file_size: media.file_size,
  };

  for (const key of extraKeys) {
    base[key] = media[key];
  }

  return base;
}
