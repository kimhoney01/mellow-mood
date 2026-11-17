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

function roundRect(context, x, y, width, height, radius) {
  const curve = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + curve, y);
  context.arcTo(x + width, y, x + width, y + height, curve);
  context.arcTo(x + width, y + height, x, y + height, curve);
  context.arcTo(x, y + height, x, y, curve);
  context.arcTo(x, y, x + width, y, curve);
  context.closePath();
}

function wrapText(context, text, maxWidth) {
  const lines = [];
  let line = "";
  Array.from(String(text || "")).forEach((glyph) => {
    const next = line + glyph;
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line);
      line = glyph.trim() ? glyph : "";
      return;
    }
    line = next;
  });
  if (line || !lines.length) {
    lines.push(line);
  }
  return lines;
}

function fitText(context, text, maxWidth) {
  const glyphs = Array.from(String(text || ""));
  let label = glyphs.join("");
  if (context.measureText(label).width <= maxWidth) {
    return label;
  }
  while (glyphs.length && context.measureText(`${glyphs.join("")}…`).width > maxWidth) {
    glyphs.pop();
  }
  return `${glyphs.join("")}…`;
}

async function optionalImage(src) {
  if (!src) {
    return null;
  }
  try {
    return await loadImage(src);
  } catch {
    return null;
  }
}

function drawCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
}

function drawGrid(context, width, height) {
  context.save();
  context.strokeStyle = "#ffeef3";
  context.lineWidth = 1;
  context.setLineDash([4, 4]);
  for (let x = 0.5; x < width; x += 28) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0.5; y < height; y += 28) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();
}

async function drawPlaylist(playlist) {
  const pageWidth = 980;
  const margin = 36;
  const frameWidth = pageWidth - margin * 2;
  const innerWidth = frameWidth - 4 - 56;
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = '600 40px "Noto Serif KR", serif';
  const titleLines = wrapText(measure, playlist.title || "플레이리스트 제목", innerWidth - 48);
  const bannerHeight = Math.max(168, titleLines.length * 48 + 48);

  measure.font = '16px "Noto Serif KR", serif';
  const tags = (playlist.tags || []).map((tag) => ({
    text: String(tag),
    width: Math.min(innerWidth, measure.measureText(String(tag)).width + 28),
    height: 36,
  }));
  const tagRows = [];
  tags.forEach((tag) => {
    const row = tagRows[tagRows.length - 1];
    if (!row || row.width + 8 + tag.width > innerWidth) {
      tagRows.push({ width: tag.width, items: [tag] });
      return;
    }
    row.width += 8 + tag.width;
    row.items.push(tag);
  });
  const tagsHeight = tagRows.length ? tagRows.length * 36 + (tagRows.length - 1) * 8 : 0;

  const tracks = (playlist.tracks || []).filter((track) => track.url).map((track) => {
    const label = fitText(measure, track.title || track.url, innerWidth - 28);
    return {
      title: label,
      url: track.url,
      width: Math.min(innerWidth, measure.measureText(label).width + 28),
      height: 48,
    };
  });
  const tracksHeight = tracks.length ? tracks.length * 48 + (tracks.length - 1) * 8 : 0;
  const contentHeight = bannerHeight
    + (tagsHeight ? 18 + tagsHeight : 0)
    + (tracksHeight ? 18 + tracksHeight : 0);
  const frameHeight = contentHeight + 60;
  const pageHeight = frameHeight + margin * 2;

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = pageWidth * scale;
  canvas.height = pageHeight * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.textBaseline = "top";

  const pageImage = playlist.page && playlist.page.kind !== "color" ? await optionalImage(playlist.page.value) : null;
  if (pageImage) {
    drawCover(context, pageImage, 0, 0, pageWidth, pageHeight);
  } else {
    context.fillStyle = (playlist.page && playlist.page.value) || "#ffffff";
    context.fillRect(0, 0, pageWidth, pageHeight);
  }
  drawGrid(context, pageWidth, pageHeight);

  const frameX = margin;
  const frameY = margin;
  roundRect(context, frameX, frameY, frameWidth, frameHeight, 16);
  context.fillStyle = "rgba(255,255,255,0.6)";
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "#c3d8b2";
  context.stroke();

  const contentX = frameX + 30;
  let cursorY = frameY + 30;
  const bannerImage = playlist.banner && playlist.banner.kind !== "color" ? await optionalImage(playlist.banner.value) : null;
  if (bannerImage) {
    drawCover(context, bannerImage, contentX, cursorY, innerWidth, bannerHeight);
  } else {
    context.fillStyle = (playlist.banner && playlist.banner.value) || "#ffeef3";
    context.fillRect(contentX, cursorY, innerWidth, bannerHeight);
  }
  context.font = '600 40px "Noto Serif KR", serif';
  context.fillStyle = playlist.titleColor || "#4b342c";
  titleLines.forEach((line, index) => {
    context.fillText(line, contentX + 24, cursorY + bannerHeight - 24 - (titleLines.length - index) * 48);
  });

  cursorY += bannerHeight;
  if (tagRows.length) {
    cursorY += 18;
    context.font = '16px "Noto Serif KR", serif';
    context.fillStyle = playlist.tagColor || "#ffeef3";
    const ink = readableInk(playlist.tagColor || "#ffeef3");
    tagRows.forEach((row) => {
      let chipX = contentX;
      row.items.forEach((tag) => {
        roundRect(context, chipX, cursorY, tag.width, tag.height, 14);
        context.fillStyle = playlist.tagColor || "#ffeef3";
        context.fill();
        context.fillStyle = ink;
        context.fillText(tag.text, chipX + 14, cursorY + 8);
        chipX += tag.width + 8;
      });
      cursorY += 44;
    });
    cursorY -= 8;
  }

  const links = [];
  if (tracks.length) {
    cursorY += 18;
    context.font = '16px "Noto Serif KR", serif';
    const fill = playlist.trackColor || "#ffffff";
    const ink = readableInk(fill);
    tracks.forEach((track) => {
      roundRect(context, contentX, cursorY, track.width, track.height, 16);
      context.fillStyle = fill;
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = "#c3d8b2";
      context.stroke();
      context.fillStyle = ink;
      context.fillText(track.title, contentX + 16, cursorY + 14);
      links.push({
        x: contentX,
        y: cursorY,
        width: track.width,
        height: track.height,
        url: track.url,
      });
      cursorY += 56;
    });
  }

  const layerWidth = frameWidth - 4;
  const layerHeight = frameHeight - 4;
  const stickerImages = await Promise.all((playlist.stickers || []).map(async (sticker) => ({
    sticker,
    image: await optionalImage(sticker.src),
  })));
  stickerImages.forEach(({ sticker, image }) => {
    if (!image) {
      return;
    }
    const width = (Number(sticker.width) || 22) / 100 * layerWidth;
    const height = width * (image.height / image.width);
    const x = frameX + 2 + (Number(sticker.x) || 0) / 100 * layerWidth;
    const y = frameY + 2 + (Number(sticker.y) || 0) / 100 * layerHeight;
    context.drawImage(image, x, y, width, height);
  });

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) {
    throw new Error("pdf");
  }
  return {
    jpeg: new Uint8Array(await blob.arrayBuffer()),
    width: pageWidth,
    height: pageHeight,
    pixelWidth: canvas.width,
    pixelHeight: canvas.height,
    links,
  };
}

function pdfString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf({ jpeg, width, height, pixelWidth, pixelHeight, links }) {
  const encoder = new TextEncoder();
  const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R /Annots [${links.map((_, index) => `${6 + index} 0 R`).join(" ")}] >>`,
    null,
    `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`,
    ...links.map((link) => {
      const bottom = height - (link.y + link.height);
      return `<< /Type /Annot /Subtype /Link /Rect [${link.x} ${bottom} ${link.x + link.width} ${height - link.y}] /Border [0 0 0] /A << /S /URI /URI (${pdfString(link.url)}) >> >>`;
    }),
  ];
  const imageHeader = encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  const imageEnd = encoder.encode("\nendstream");

  const parts = [];
  let offset = 0;
  const append = (bytes) => {
    parts.push(bytes);
    offset += bytes.length;
  };
  append(encoder.encode("%PDF-1.4\n"));
  const xref = [0];
  objects.forEach((object, index) => {
    xref.push(offset);
    append(encoder.encode(`${index + 1} 0 obj\n`));
    if (index === 3) {
      append(imageHeader);
      append(jpeg);
      append(imageEnd);
    } else {
      append(encoder.encode(object));
    }
    append(encoder.encode("\nendobj\n"));
  });
  const xrefStart = offset;
  let table = `xref\n0 ${xref.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < xref.length; index += 1) {
    table += `${String(xref[index]).padStart(10, "0")} 00000 n \n`;
  }
  table += `trailer\n<< /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  append(encoder.encode(table));
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(total);
  let cursor = 0;
  parts.forEach((part) => {
    bytes.set(part, cursor);
    cursor += part.length;
  });
  return bytes;
}

function pdfFileName(title) {
  const safe = String(title || "playlist").replace(/[\\/:*?"<>|]/g, " ").trim() || "playlist";
  return `${safe}.pdf`;
}

async function downloadPlaylistPdf(playlist) {
  await document.fonts.load('600 40px "Noto Serif KR"');
  await document.fonts.load('16px "Noto Serif KR"');
  const page = await drawPlaylist(playlist);
  const bytes = buildPdf(page);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = pdfFileName(playlist.title);
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  shareButton.textContent = "완료";
  showShareNote("");
  window.setTimeout(() => {
    shareButton.textContent = "PDF";
  }, 1600);
}

function bindShare(playlist) {
  shareButton.hidden = false;
  shareButton.addEventListener("click", async () => {
    shareButton.disabled = true;
    try {
      await downloadPlaylistPdf(playlist);
    } catch {
      showShareNote("PDF를 만들지 못했어요.");
    } finally {
      shareButton.disabled = false;
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
