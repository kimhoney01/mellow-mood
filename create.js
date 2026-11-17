const palette = {
  main: "#FFFFFF",
  sub: "#FFEEF3",
  point: "#C3D8B2",
};

const titleBanner = document.querySelector("#title-banner");
const titleInput = document.querySelector("#playlist-title");
const titleColor = document.querySelector("#title-color");
const titleHex = document.querySelector("#title-hex");

function cssUrl(value) {
  return `url("${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

function applySurface(element, surface) {
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

function showNote(note, message) {
  note.hidden = !message;
  note.textContent = message || "";
}

function selectSwatch(group, colorName) {
  group.querySelectorAll(".swatch").forEach((swatch) => {
    swatch.setAttribute("aria-pressed", String(swatch.dataset.color === colorName));
  });
}

function clearSwatches(group) {
  group.querySelectorAll(".swatch").forEach((swatch) => {
    swatch.setAttribute("aria-pressed", "false");
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
    image.src = src;
  });
}

function rememberSurface(surface, next) {
  surface.kind = next.kind;
  surface.value = next.value;
  surface.swatch = next.swatch || "";
  surface.link = next.link || "";
}

function setupSurface(group, target, surface) {
  const note = group.querySelector(".surface-note");
  const linkInput = group.querySelector(".link-input");

  const paint = () => {
    applySurface(target, surface);
    if (surface.swatch) {
      selectSwatch(group, surface.swatch);
    } else {
      clearSwatches(group);
    }
    linkInput.value = surface.link;
  };

  group.querySelectorAll(".swatch").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      const colorName = swatch.dataset.color;
      rememberSurface(surface, {
        kind: "color",
        value: palette[colorName],
        swatch: colorName,
      });
      paint();
      showNote(note, "");
    });
  });

  group.querySelector('input[type="file"]').addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      showNote(note, "이미지 파일만 올릴 수 있어요.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      rememberSurface(surface, { kind: "image", value: reader.result });
      paint();
      showNote(note, "");
    };
    reader.onerror = () => showNote(note, "파일을 읽지 못했어요.");
    reader.readAsDataURL(file);
  });

  group.querySelector(".apply-link").addEventListener("click", async () => {
    const src = linkInput.value.trim();
    if (!src) {
      showNote(note, "이미지 링크를 입력해 주세요.");
      return;
    }

    try {
      await loadImage(src);
      rememberSurface(surface, { kind: "image", value: src, link: src });
      paint();
      showNote(note, "");
    } catch (error) {
      showNote(note, error.message);
    }
  });

  paint();
}

function paintTitle(color) {
  titleInput.style.color = color;
  titleHex.textContent = color.toUpperCase();
}

function characterCount(text) {
  return Array.from(text).length;
}

function readableInk(hex) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.62 ? "#4B342C" : "#FFFFFF";
}

function bindColorPicker(input, hexLabel, target, fillName, inkName) {
  const paint = () => {
    const color = input.value.toUpperCase();
    hexLabel.textContent = color;
    target.style.setProperty(fillName, color);
    target.style.setProperty(inkName, readableInk(color));
  };
  input.addEventListener("input", paint);
  paint();
}

function youtubeVideoId(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return "";
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] || "";
  }
  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") {
    return "";
  }

  if (url.pathname === "/watch") {
    return url.searchParams.get("v") || "";
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (["shorts", "embed", "live"].includes(parts[0])) {
    return parts[1] || "";
  }
  return "";
}

async function fetchYoutubeTitle(pageUrl) {
  const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(pageUrl)}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error("영상 제목을 불러오지 못했어요.");
  }
  const data = await response.json();
  if (!data.title) {
    throw new Error("영상 제목을 불러오지 못했어요.");
  }
  return data.title;
}

function bindMarquee(viewport, label) {
  if (characterCount(label.textContent) <= 15) {
    return;
  }

  label.addEventListener("transitionend", () => {
    if (viewport.dataset.playing !== "true") {
      label.style.transition = "";
    }
  });

  viewport.addEventListener("mouseenter", () => {
    const distance = label.scrollWidth - viewport.clientWidth;
    if (distance <= 0) {
      return;
    }
    viewport.dataset.playing = "true";
    const seconds = Math.max(2.4, distance / 36);
    label.style.transition = `transform ${seconds}s linear`;
    label.style.transform = `translateX(-${distance}px)`;
  });

  viewport.addEventListener("mouseleave", () => {
    viewport.dataset.playing = "false";
    label.style.transition = "transform 0.35s ease";
    label.style.transform = "translateX(0)";
  });
}

function setupTags() {
  const openButton = document.querySelector("#add-tag");
  const form = document.querySelector("#tag-form");
  const list = document.querySelector("#tag-list");
  const input = form.querySelector("input");
  const note = form.querySelector(".entry-note");
  const maxTags = 10;

  const addTag = (value) => {
    if (list.children.length >= maxTags) {
      showNote(note, "태그는 10개까지 추가할 수 있어요.");
      return false;
    }

    const item = document.createElement("li");
    item.className = "tag-chip";
    const label = document.createElement("span");
    label.textContent = value;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "삭제";
    removeButton.setAttribute("aria-label", `${value} 삭제`);
    removeButton.addEventListener("click", () => {
      item.remove();
      if (list.children.length < maxTags) {
        showNote(note, "");
      }
    });
    item.append(label, removeButton);
    list.append(item);
    return true;
  };

  openButton.addEventListener("click", () => {
    form.hidden = false;
    if (list.children.length >= maxTags) {
      showNote(note, "태그는 10개까지 추가할 수 있어요.");
      return;
    }
    input.focus();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      showNote(note, "태그를 입력해 주세요.");
      return;
    }
    if (addTag(value)) {
      input.value = "";
      showNote(note, "");
    }
  });

  bindColorPicker(
    document.querySelector("#tag-color"),
    document.querySelector("#tag-hex"),
    list,
    "--tag-fill",
    "--tag-ink"
  );

  return { addTag, list };
}

function setupTracks() {
  const openButton = document.querySelector("#add-music");
  const form = document.querySelector("#music-form");
  const list = document.querySelector("#music-list");
  const input = form.querySelector("input");
  const note = form.querySelector(".entry-note");
  const submitButton = form.querySelector('button[type="submit"]');

  const addTrack = (title, url) => {
    const item = document.createElement("li");
    item.className = "track-card";
    item.dataset.url = url;
    const viewport = document.createElement("div");
    viewport.className = "track-viewport";
    const label = document.createElement("span");
    label.className = "track-title";
    label.textContent = title;
    label.title = title;
    viewport.append(label);
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "삭제";
    removeButton.setAttribute("aria-label", `${title} 삭제`);
    removeButton.addEventListener("click", () => item.remove());
    item.append(viewport, removeButton);
    list.append(item);
    bindMarquee(viewport, label);
  };

  openButton.addEventListener("click", () => {
    form.hidden = false;
    input.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      showNote(note, "유튜브 영상 링크를 입력해 주세요.");
      return;
    }
    if (!youtubeVideoId(value)) {
      showNote(note, "유튜브 영상 링크를 입력해 주세요.");
      return;
    }

    submitButton.disabled = true;
    showNote(note, "제목을 불러오는 중이에요.");
    try {
      const title = await fetchYoutubeTitle(value);
      addTrack(title, value);
      input.value = "";
      showNote(note, "");
    } catch (error) {
      showNote(note, error.message);
    } finally {
      submitButton.disabled = false;
    }
  });

  bindColorPicker(
    document.querySelector("#track-color"),
    document.querySelector("#track-hex"),
    list,
    "--track-fill",
    "--track-ink"
  );

  return { addTrack, list };
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

function collectPlaylist(bannerSurface, pageSurface) {
  return {
    title: titleInput.value.trim(),
    titleColor: titleColor.value,
    banner: { ...bannerSurface },
    page: { ...pageSurface },
    tagColor: document.querySelector("#tag-color").value,
    tags: [...document.querySelectorAll("#tag-list .tag-chip span")].map((label) => label.textContent),
    trackColor: document.querySelector("#track-color").value,
    tracks: [...document.querySelectorAll("#music-list .track-card")].map((card) => ({
      title: card.querySelector(".track-title").textContent,
      url: card.dataset.url,
    })),
    stickers: stickerDesk.serialize(),
  };
}

const pageParams = new URLSearchParams(location.search);
const editId = pageParams.get("edit");
const signedInUser = currentUser();

if (editId && !signedInUser) {
  location.href = `login.html?next=edit&id=${encodeURIComponent(editId)}`;
}
const savedPlaylist = pageParams.get("draft") === "1"
  ? loadDraft()
  : editId && signedInUser
    ? getPlaylist(signedInUser, editId)
    : null;

if (savedPlaylist) {
  titleInput.value = savedPlaylist.title || "";
  titleColor.value = savedPlaylist.titleColor || "#4B342C";
  document.querySelector("#tag-color").value = savedPlaylist.tagColor || "#FFEEF3";
  document.querySelector("#track-color").value = savedPlaylist.trackColor || "#FFFFFF";
}

paintTitle(titleColor.value);
titleColor.addEventListener("input", () => paintTitle(titleColor.value));

const bannerSurface = savedPlaylist && savedPlaylist.banner
  ? { ...savedPlaylist.banner }
  : { kind: "color", value: palette.sub, swatch: "sub", link: "" };
const pageSurface = savedPlaylist && savedPlaylist.page
  ? { ...savedPlaylist.page }
  : { kind: "color", value: palette.main, swatch: "main", link: "" };

setupSurface(document.querySelector('[data-surface="banner"]'), titleBanner, bannerSurface);
setupSurface(document.querySelector('[data-surface="page"]'), document.body, pageSurface);

const tags = setupTags();
const tracks = setupTracks();
const stickerDesk = setupStickerLayer(
  document.querySelector("#sticker-layer"),
  savedPlaylist && savedPlaylist.stickers ? savedPlaylist.stickers : [],
  true
);
const stickerNote = document.querySelector("#sticker-note");
document.querySelector("#sticker-file").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    showNote(stickerNote, "이미지 파일만 올릴 수 있어요.");
    return;
  }
  if (stickerDesk.serialize().length >= 5) {
    showNote(stickerNote, "스티커는 5개까지 추가할 수 있어요.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const added = stickerDesk.add(reader.result);
    showNote(stickerNote, added ? "" : "스티커는 5개까지 추가할 수 있어요.");
  };
  reader.onerror = () => showNote(stickerNote, "파일을 읽지 못했어요.");
  reader.readAsDataURL(file);
});

if (savedPlaylist) {
  (savedPlaylist.tags || []).forEach((tag) => tags.addTag(tag));
  (savedPlaylist.tracks || []).forEach((track) => tracks.addTrack(track.title, track.url));
}

if (pageParams.get("limit") === "1") {
  showNote(document.querySelector("#save-note"), "플레이리스트는 계정당 5개까지 저장할 수 있어요.");
}

const previewScreen = document.querySelector("#preview-screen");
const createScreen = document.querySelector(".create-screen");

function closePreview() {
  previewScreen.hidden = true;
  createScreen.hidden = false;
  document.querySelector("#preview-sticker-layer").replaceChildren();
}

function openPreview() {
  const playlist = collectPlaylist(bannerSurface, pageSurface);
  const title = document.querySelector("#preview-title");
  const tagList = document.querySelector("#preview-tags");
  const trackList = document.querySelector("#preview-tracks");
  const stickerLayer = document.querySelector("#preview-sticker-layer");

  title.textContent = playlist.title || "플레이리스트 제목";
  title.style.color = playlist.titleColor || "#4B342C";
  applySurface(document.querySelector("#preview-banner"), playlist.banner);

  tagList.replaceChildren();
  tagList.style.setProperty("--tag-fill", playlist.tagColor || "#FFEEF3");
  tagList.style.setProperty("--tag-ink", readableInk(playlist.tagColor || "#FFEEF3"));
  playlist.tags.forEach((tag) => {
    const item = document.createElement("li");
    item.className = "tag-chip";
    const label = document.createElement("span");
    label.textContent = tag;
    item.append(label);
    tagList.append(item);
  });

  trackList.replaceChildren();
  trackList.style.setProperty("--track-fill", playlist.trackColor || "#FFFFFF");
  trackList.style.setProperty("--track-ink", readableInk(playlist.trackColor || "#FFFFFF"));
  playlist.tracks.forEach((track) => {
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

  createScreen.hidden = true;
  previewScreen.hidden = false;
  stickerLayer.replaceChildren();
  setupStickerLayer(stickerLayer, playlist.stickers, false);
  document.querySelector("#close-preview").focus();
}

document.querySelector("#preview-playlist").addEventListener("click", openPreview);
document.querySelector("#close-preview").addEventListener("click", closePreview);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !previewScreen.hidden) {
    closePreview();
  }
});

document.querySelector("#save-playlist").addEventListener("click", () => {
  const note = document.querySelector("#save-note");
  const playlist = collectPlaylist(bannerSurface, pageSurface);
  playlist.id = savedPlaylist && savedPlaylist.id ? savedPlaylist.id : "";
  const user = currentUser();

  if (!user) {
    saveDraft(playlist);
    location.href = "login.html?next=save";
    return;
  }

  try {
    const result = saveAccountPlaylist(user, playlist);
    if (!result.ok) {
      showNote(note, result.message);
      return;
    }
    clearDraft();
    location.href = `playlist.html?id=${encodeURIComponent(result.playlist.id)}`;
  } catch {
    showNote(note, "저장하지 못했어요. 이미지 용량을 줄여 주세요.");
  }
});
