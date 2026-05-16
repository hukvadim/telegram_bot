export function getProfileText(msg) {
  return msg?.text || msg?.caption || "";
}

export function getPhotoUniqueIds(msg) {
  if (!Array.isArray(msg?.photo)) return [];

  return msg.photo.map((p) => p.file_unique_id).filter(Boolean);
}

export function isProfileText(text = "") {
  const value = text.toLowerCase();

  return (
    /ім['’`]?я\s*:/i.test(value) ||
    /вік\s*:\s*\d+/i.test(value) ||
    /місто\s*:/i.test(value)
  );
}

export function detectGroupType(chatTitle = "") {
  const value = chatTitle.toLowerCase();

  if (value.includes("normal")) return "normal";
  if (value.includes("spam")) return "spam";
  if (value.includes("taster")) return "taster";

  return "unknown";
}

export function getProfileBase(text = "") {
  const name = cleanProfileValue(getField(text, ["ім['’`]?я", "имя", "name"]));
  const age = cleanProfileValue(getField(text, ["вік", "возраст", "age"]));
  const city = normalizeCity(getField(text, ["місто", "город", "city"]));
  const about = cleanProfileValue(getAbout(text));

  return [
    `name:${name}`,
    `age:${age}`,
    `city:${city}`,
    `about:${about}`,
  ].join("|");
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
  const value = cleanProfileValue(city);

  if (value === "киев" || value === "kiev" || value === "kyiv") return "київ";

  return value;
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
