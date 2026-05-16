import crypto from "crypto";

import {
  getPhotoUniqueIds,
  getProfileBase,
  getProfileText,
} from "./profile.text.js";

export function buildProfileId(msg) {
  const text = getProfileText(msg);
  const profileBase = getProfileBase(text);
  const mainPhotoUniqueId = getMainPhotoUniqueId(msg);
  const allPhotoUniqueIds = getPhotoUniqueIds(msg);
  const origin = msg.forward_origin;

  const profileId = `profile_${hash(profileBase)}`;
  const mediaId = mainPhotoUniqueId ? `media_${hash(mainPhotoUniqueId)}` : null;
  const sourceId = `source_${hash(buildSourceBase(msg, origin))}`;

  return {
    id: profileId,
    profileId,
    mediaId,
    sourceId,
    strategy: "profile_text_hash",
    profileBase,
    mainPhotoUniqueId,
    allPhotoUniqueIds,
  };
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function getMainPhotoUniqueId(msg) {
  if (!Array.isArray(msg?.photo) || !msg.photo.length) return "";

  const biggest = [...msg.photo].sort((a, b) => {
    const aSize = (a.width || 0) * (a.height || 0);
    const bSize = (b.width || 0) * (b.height || 0);

    return bSize - aSize;
  })[0];

  return biggest?.file_unique_id || "";
}

function buildSourceBase(msg, origin) {
  return [
    origin?.type || "",
    origin?.sender_user?.id || "",
    origin?.sender_user?.username || "",
    origin?.date || "",
    msg.chat?.id || "",
    msg.message_id || "",
  ].join("|");
}
