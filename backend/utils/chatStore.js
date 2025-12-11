// utils/chatStore.js
import Chat from "../models/Chat.js";

/** return YYYY-MM-DD */
export function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Ensure user doc exists and return it (fresh from DB)
 */
export async function ensureUserDoc(userEmail) {
  let doc = await Chat.findOne({ userEmail });
  if (!doc) {
    doc = new Chat({ userEmail, history: [] });
    await doc.save();
  }
  return doc;
}

/**
 * Append a chat to user->date->section (creates date/section if missing).
 * message: { role, text, image?, timestamp? }
 */
export async function appendChat(userEmail, sectionId, message, date = new Date()) {
  const dateKey = getDateKey(date);

  // Try an atomic update: find the exact nested path and push
  // If doc/paths missing, fallback to in-memory creation & save
  // First attempt: try findOneAndUpdate for existing date + section
  const pushPath = {
    $push: {
      "history.$[dateBucket].sections.$[sec].chats": {
        role: message.role,
        text: message.text || "",
        image: message.image || null,
        timestamp: message.timestamp || new Date()
      }
    }
  };
  const arrayFilters = [
    { "dateBucket.date": dateKey },
    { "sec.sectionId": sectionId }
  ];

  const updated = await Chat.findOneAndUpdate(
    { userEmail },
    pushPath,
    { arrayFilters, new: true }
  ).lean();

  if (updated) {
    return { ok: true, method: "atomic-update" };
  }

  // fallback: create doc/date/section in-memory
  let doc = await ensureUserDoc(userEmail);

  let dateBucket = doc.history.find(b => b.date === dateKey);
  if (!dateBucket) {
    dateBucket = { date: dateKey, sections: [] };
    doc.history.push(dateBucket);
  }

  let section = dateBucket.sections.find(s => s.sectionId === sectionId);
  if (!section) {
    section = { sectionId, chats: [] };
    dateBucket.sections.push(section);
  }

  section.chats.push({
    role: message.role,
    text: message.text || "",
    image: message.image || null,
    timestamp: message.timestamp || new Date()
  });

  await doc.save();
  return { ok: true, method: "fallback-save" };
}

/**
 * Read chats for a user/date/section (returns array or null)
 */
export async function fetchSection(userEmail, sectionId, date = new Date()) {
  const dateKey = getDateKey(date);
  const doc = await Chat.findOne({ userEmail }, { history: 1 }).lean();
  if (!doc) return null;
  const dateBucket = (doc.history || []).find(b => b.date === dateKey);
  if (!dateBucket) return null;
  const section = (dateBucket.sections || []).find(s => s.sectionId === sectionId);
  return section ? section.chats : null;
}

/**
 * List dates & sections for a user (overview)
 */
export async function listOverview(userEmail) {
  const doc = await Chat.findOne({ userEmail }, { history: 1 }).lean();
  if (!doc) return [];
  return (doc.history || []).map(b => ({
    date: b.date,
    sections: (b.sections || []).map(s => s.sectionId)
  }));
}
