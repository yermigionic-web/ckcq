function canUseStorage() {
  try {
    const key = "__fandomBingoProbe";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const memoryStore = new Map();

function readRaw(key) {
  if (canUseStorage()) {
    return window.localStorage.getItem(key);
  }
  return memoryStore.get(key) ?? null;
}

function writeRaw(key, value) {
  if (canUseStorage()) {
    window.localStorage.setItem(key, value);
    return;
  }
  memoryStore.set(key, value);
}

function removeRaw(key) {
  if (canUseStorage()) {
    window.localStorage.removeItem(key);
    return;
  }
  memoryStore.delete(key);
}

export function loadProgress(storageKey) {
  const fallback = { completedIds: [], order: null, failCounts: {}, updatedAt: null };
  const raw = readRaw(storageKey);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    const completedIds = Array.isArray(parsed.completedIds)
      ? parsed.completedIds.filter((id) => typeof id === "string")
      : [];
    const order = Array.isArray(parsed.order)
      ? parsed.order.filter((id) => typeof id === "string")
      : null;
    return {
      completedIds,
      order,
      failCounts: sanitizeFailCounts(parsed.failCounts),
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return fallback;
  }
}

function sanitizeFailCounts(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const counts = {};
  Object.entries(value).forEach(([id, raw]) => {
    const count = Number(raw);
    if (typeof id === "string" && Number.isFinite(count) && count > 0) {
      counts[id] = Math.min(99, Math.floor(count));
    }
  });
  return counts;
}

export function saveProgress(storageKey, { completedIds, order, failCounts }) {
  const current = loadProgress(storageKey);
  const payload = {
    completedIds: [...new Set(completedIds)],
    order: Array.isArray(order) ? order : current.order,
    failCounts: failCounts && typeof failCounts === "object" ? sanitizeFailCounts(failCounts) : current.failCounts,
    updatedAt: new Date().toISOString(),
  };
  writeRaw(storageKey, JSON.stringify(payload));
  return payload;
}

export function clearProgress(storageKey) {
  removeRaw(storageKey);
  return { completedIds: [], order: null, failCounts: {}, updatedAt: null };
}
