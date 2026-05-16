import { AI_CHECK_API } from "../env.js";
import { buildProfileId } from "./profile.id.js";
import {
  detectGroupType,
  getPhotoUniqueIds,
  getProfileText,
  isProfileText,
} from "./profile.text.js";

export async function handleProfileMessage(msg) {
  const profile = buildProfileFromMessage(msg);

  if (!profile) {
    console.log("skip non-profile message");
    return;
  }

  console.log("NEW PROFILE:");
  console.log(JSON.stringify(profile, null, 2));

  await saveProfile(profile);
}

function buildProfileFromMessage(msg) {
  const chat = msg.chat || {};
  const text = getProfileText(msg);
  const photoUniqueIds = getPhotoUniqueIds(msg);
  const groupType = detectGroupType(chat.title || "");

  if (!isProfileText(text) && !photoUniqueIds.length) {
    return null;
  }

  const stable = buildProfileId(msg);

  return {
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

    description: buildDescription({
      groupType,
      chat,
      stable,
      photoUniqueIds,
    }),
  };
}

async function saveProfile(profile) {
  if (!AI_CHECK_API) return null;

  const res = await fetch(`${AI_CHECK_API}/activity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profileId: profile.profileId,
      reaction: getReaction(profile.groupType),
      description: profile.description,
    }),
  });

  if (!res.ok) {
    console.error("AI_CHECK save error:", res.status);
    return null;
  }

  return res.json();
}

function getReaction(groupType) {
  if (groupType === "spam") return "dislike";
  if (groupType === "normal") return "like";

  return "none";
}

function buildDescription({ groupType, chat, stable, photoUniqueIds }) {
  return [
    `group:${groupType}`,
    `chat:${chat.title || chat.id}`,
    `strategy:${stable.strategy}`,
    `profileId:${stable.profileId}`,
    `mediaId:${stable.mediaId || ""}`,
    `sourceId:${stable.sourceId || ""}`,
    `profileBase:${stable.profileBase}`,
    `photos:${photoUniqueIds.join(",")}`,
  ].join("|");
}
