const usersKey = "mellow-mood-users";
const sessionKey = "mellow-mood-session";
const playlistsKey = "mellow-mood-playlists";
const draftKey = "mellow-mood-draft";
const playlistLimit = 5;

function readJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function currentUser() {
  return localStorage.getItem(sessionKey) || "";
}

function setSession(email) {
  localStorage.setItem(sessionKey, email);
}

function clearSession() {
  localStorage.removeItem(sessionKey);
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function registerAccount(email, password) {
  const normalized = normalizeEmail(email);
  if (!isEmail(normalized)) {
    return { ok: false, message: "이메일 형식을 확인해 주세요." };
  }
  if (String(password).length < 6) {
    return { ok: false, message: "비밀번호는 6자 이상으로 입력해 주세요." };
  }

  const users = readJson(usersKey, []);
  if (users.some((user) => user.email === normalized)) {
    return { ok: false, message: "이미 가입된 이메일이에요." };
  }

  const salt = crypto.randomUUID();
  users.push({
    email: normalized,
    salt,
    passwordHash: await hashPassword(password, salt),
  });
  localStorage.setItem(usersKey, JSON.stringify(users));
  setSession(normalized);
  return { ok: true, email: normalized };
}

async function loginAccount(email, password) {
  const normalized = normalizeEmail(email);
  const users = readJson(usersKey, []);
  const user = users.find((item) => item.email === normalized);
  if (!user) {
    return { ok: false, message: "이메일 또는 비밀번호를 확인해 주세요." };
  }
  const passwordHash = await hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) {
    return { ok: false, message: "이메일 또는 비밀번호를 확인해 주세요." };
  }
  setSession(normalized);
  return { ok: true, email: normalized };
}

function readPlaylists() {
  return readJson(playlistsKey, {});
}

function listPlaylists(email) {
  return readPlaylists()[email] || [];
}

function getPlaylist(email, id) {
  return listPlaylists(email).find((playlist) => playlist.id === id) || null;
}

function saveAccountPlaylist(email, playlist) {
  const all = readPlaylists();
  const list = all[email] ? [...all[email]] : [];
  const next = { ...playlist, updatedAt: Date.now() };

  if (next.id) {
    const index = list.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      list[index] = next;
      all[email] = list;
      localStorage.setItem(playlistsKey, JSON.stringify(all));
      return { ok: true, playlist: next };
    }
  }

  if (list.length >= playlistLimit) {
    return { ok: false, message: "플레이리스트는 계정당 5개까지 저장할 수 있어요." };
  }

  next.id = crypto.randomUUID();
  list.push(next);
  all[email] = list;
  localStorage.setItem(playlistsKey, JSON.stringify(all));
  return { ok: true, playlist: next };
}

function saveDraft(playlist) {
  sessionStorage.setItem(draftKey, JSON.stringify(playlist));
}

function loadDraft() {
  const raw = sessionStorage.getItem(draftKey);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearDraft() {
  sessionStorage.removeItem(draftKey);
}

async function continueAfterAuth() {
  const params = new URLSearchParams(location.search);
  const next = params.get("next");
  const email = currentUser();

  if (next === "save") {
    const draft = loadDraft();
    if (draft) {
      const result = saveAccountPlaylist(email, draft);
      if (result.ok) {
        clearDraft();
        location.href = `playlist.html?id=${encodeURIComponent(result.playlist.id)}`;
        return;
      }
      location.href = "create.html?draft=1&limit=1";
      return;
    }
  }

  if (next === "edit" && params.get("id")) {
    location.href = `create.html?edit=${encodeURIComponent(params.get("id"))}`;
    return;
  }

  location.href = "index.html";
}
