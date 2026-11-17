const palette = {
  main: "#FFFFFF",
};

function cssUrl(value) {
  return `url("${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

function applySurface(element, surface) {
  if (!surface) {
    return;
  }
  if (surface.kind === "color") {
    element.style.backgroundColor = surface.value;
    element.style.backgroundImage = "none";
    return;
  }
  element.style.backgroundColor = palette.main;
  element.style.backgroundImage = cssUrl(surface.value);
  element.style.backgroundSize = "cover";
  element.style.backgroundPosition = "center";
  element.style.backgroundRepeat = "no-repeat";
}

function readableInk(hex) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) {
    return "#4B342C";
  }
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.62 ? "#4B342C" : "#FFFFFF";
}

function characterCount(text) {
  return Array.from(text).length;
}

function bindMarquee(viewport, label) {
  if (characterCount(label.textContent) <= 15) {
    return;
  }

  viewport.addEventListener("mouseenter", () => {
    const distance = label.scrollWidth - viewport.clientWidth;
    if (distance <= 0) {
      return;
    }
    const seconds = Math.max(2.4, distance / 36);
    label.style.transition = `transform ${seconds}s linear`;
    label.style.transform = `translateX(-${distance}px)`;
  });

  viewport.addEventListener("mouseleave", () => {
    label.style.transition = "transform 0.35s ease";
    label.style.transform = "translateX(0)";
  });
}

const title = document.querySelector("#playlist-title");
const banner = document.querySelector("#title-banner");
const tagList = document.querySelector("#tag-list");
const trackList = document.querySelector("#music-list");
const emptyNote = document.querySelector("#empty-note");
const shareNote = document.querySelector("#share-note");
const shareButton = document.querySelector("#share-playlist");
const editButton = document.querySelector(".banner-actions .edit-button[href]");

function showShareNote(message) {
  shareNote.hidden = !message;
  shareNote.textContent = message;
}

function shareRecord(playlist) {
  return {
    title: playlist.title || "",
    titleColor: playlist.titleColor || "#4B342C",
    banner: playlist.banner || null,
    page: playlist.page || null,
    tagColor: playlist.tagColor || "#FFEEF3",
    tags: playlist.tags || [],
    trackColor: playlist.trackColor || "#FFFFFF",
    tracks: (playlist.tracks || []).map((track) => ({
      title: String(track.title || ""),
      url: String(track.url || ""),
    })),
    stickers: playlist.stickers || [],
  };
}

function bytesToBase64Url(bytes) {
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    let piece = "";
    for (let offset = 0; offset < chunk.length; offset += 1) {
      piece += String.fromCharCode(chunk[offset]);
    }
    binary += piece;
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    bytes.set(part, offset);
    offset += part.length;
  });
  return bytes;
}

function uint32Bytes(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

async function gzipBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function imageMime(bytes) {
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return "image/webp";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return "image/png";
  }
  return "image/webp";
}

function bytesToDataUrl(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return `data:${imageMime(bytes)};base64,${btoa(binary)}`;
}

async function encodePackedShare(meta, images) {
  const json = new TextEncoder().encode(JSON.stringify(meta));
  const parts = [new Uint8Array([2]), uint32Bytes(json.length), json];
  images.forEach((image) => {
    parts.push(uint32Bytes(image.length), image);
  });
  return bytesToBase64Url(await gzipBytes(concatBytes(parts)));
}

function unpackShare(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(1);
  let offset = 5;
  const meta = JSON.parse(new TextDecoder().decode(bytes.subarray(offset, offset + jsonLength)));
  offset += jsonLength;
  const images = [];
  while (offset + 4 <= bytes.length) {
    const size = view.getUint32(offset);
    offset += 4;
    images.push(bytes.subarray(offset, offset + size));
    offset += size;
  }
  const sourceAt = (value) => (typeof value === "number" ? bytesToDataUrl(images[value]) : value);
  const surface = (value) => {
    if (!value || value.kind === "color" || typeof value.value !== "number") {
      return value;
    }
    return { ...value, value: sourceAt(value.value) };
  };
  return {
    ...meta,
    banner: surface(meta.banner),
    page: surface(meta.page),
    stickers: (meta.stickers || []).map((sticker) => ({
      ...sticker,
      src: sourceAt(sticker.src),
    })),
  };
}

async function decodeShare(token) {
  const bytes = await gunzipBytes(base64UrlToBytes(token));
  if (bytes[0] === 123) {
    const playlist = JSON.parse(new TextDecoder().decode(bytes));
    if (!playlist || Array.isArray(playlist)) {
      throw new Error("invalid share");
    }
    return playlist;
  }
  if (bytes[0] !== 2) {
    throw new Error("invalid share");
  }
  return unpackShare(bytes);
}

function renderPlaylist(playlist) {
  title.textContent = playlist.title || "플레이리스트 제목";
  title.style.color = playlist.titleColor || "#4B342C";
  document.title = `${title.textContent} · Mellow Mood`;
  applySurface(banner, playlist.banner);
  applySurface(document.body, playlist.page);

  tagList.style.setProperty("--tag-fill", playlist.tagColor || "#FFEEF3");
  tagList.style.setProperty("--tag-ink", readableInk(playlist.tagColor || "#FFEEF3"));
  (playlist.tags || []).forEach((tag) => {
    const item = document.createElement("li");
    item.className = "tag-chip";
    const label = document.createElement("span");
    label.textContent = String(tag);
    item.append(label);
    tagList.append(item);
  });

  trackList.style.setProperty("--track-fill", playlist.trackColor || "#FFFFFF");
  trackList.style.setProperty("--track-ink", readableInk(playlist.trackColor || "#FFFFFF"));
  (playlist.tracks || []).forEach((track) => {
    const item = document.createElement("li");
    item.className = "track-card";
    const viewport = document.createElement("div");
    viewport.className = "track-viewport";
    const label = document.createElement("a");
    label.className = "track-title";
    label.href = track.url;
    label.target = "_blank";
    label.rel = "noreferrer";
    label.textContent = track.title;
    label.title = track.title;
    viewport.append(label);
    item.append(viewport);
    trackList.append(item);
    bindMarquee(viewport, label);
  });

  setupStickerLayer(document.querySelector("#sticker-layer"), playlist.stickers || [], false);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

async function compactImageBytes(src, maxEdge, quality) {
  const image = await loadImage(src);
  const longest = Math.max(image.width, image.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) {
    throw new Error("image");
  }
  return new Uint8Array(await blob.arrayBuffer());
}

async function shareToken(playlist, step) {
  const images = [];
  const storeImage = async (src, maxEdge) => {
    if (!String(src || "").startsWith("data:")) {
      return src;
    }
    images.push(await compactImageBytes(src, maxEdge, step.quality));
    return images.length - 1;
  };
  const storeSurface = async (surface, maxEdge) => {
    if (!surface || surface.kind === "color" || !surface.value) {
      return surface;
    }
    return { ...surface, value: await storeImage(surface.value, maxEdge) };
  };
  const meta = {
    ...shareRecord(playlist),
    banner: await storeSurface(playlist.banner, step.surface),
    page: await storeSurface(playlist.page, step.surface),
    stickers: await Promise.all((playlist.stickers || []).map(async (sticker) => ({
      x: sticker.x,
      y: sticker.y,
      width: sticker.width,
      locked: Boolean(sticker.locked),
      src: await storeImage(sticker.src, step.sticker),
    }))),
  };
  return encodePackedShare(meta, images);
}

async function copyShareLink(playlist) {
  const steps = [
    { sticker: 240, surface: 640, quality: 0.46 },
    { sticker: 160, surface: 420, quality: 0.34 },
    { sticker: 112, surface: 300, quality: 0.26 },
    { sticker: 80, surface: 220, quality: 0.2 },
  ];
  const limit = 8000;
  let token = "";
  for (const step of steps) {
    token = await shareToken(playlist, step);
    if (location.origin.length + location.pathname.length + token.length + 3 <= limit) {
      break;
    }
  }
  const url = new URL(location.pathname, location.origin);
  url.hash = `s=${token}`;
  if (url.href.length > limit) {
    showShareNote("이미지가 커서 공유 링크를 만들 수 없어요.");
    return;
  }
  await navigator.clipboard.writeText(url.href);
  shareButton.textContent = "복사됨";
  showShareNote("");
  window.setTimeout(() => {
    shareButton.textContent = "공유";
  }, 1600);
}

function bindShare(playlist) {
  shareButton.hidden = false;
  shareButton.addEventListener("click", async () => {
    try {
      await copyShareLink(playlist);
    } catch {
      showShareNote("링크를 복사하지 못했어요.");
    }
  });
}

function showMissingPlaylist(signedInUser) {
  emptyNote.hidden = false;
  emptyNote.textContent = signedInUser
    ? "플레이리스트를 찾지 못했어요."
    : "로그인하면 플레이리스트를 볼 수 있어요.";
  editButton.hidden = true;
  shareButton.hidden = true;
}

async function startPlaylistPage() {
  if (location.hash.startsWith("#s=")) {
    try {
      const playlist = await decodeShare(location.hash.slice(3));
      editButton.hidden = true;
      renderPlaylist(playlist);
      bindShare(playlist);
    } catch {
      emptyNote.hidden = false;
      emptyNote.textContent = "공유 링크를 열지 못했어요.";
      editButton.hidden = true;
    }
    return;
  }

  const pageParams = new URLSearchParams(location.search);
  const signedInUser = currentUser();
  const playlist = signedInUser ? getPlaylist(signedInUser, pageParams.get("id")) : null;
  if (!playlist) {
    showMissingPlaylist(signedInUser);
    return;
  }

  editButton.href = `create.html?edit=${encodeURIComponent(playlist.id)}`;
  renderPlaylist(playlist);
  bindShare(playlist);
}

startPlaylistPage();
