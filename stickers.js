function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readSticker(record) {
  return {
    src: record.src,
    x: Number(record.x.toFixed(1)),
    y: Number(record.y.toFixed(1)),
    width: Number(record.width.toFixed(1)),
    locked: Boolean(record.locked),
  };
}

function placeSticker(element, record, frame) {
  element.style.width = `${record.width}%`;
  const frameRect = frame.getBoundingClientRect();
  if (frameRect.width <= 0 || frameRect.height <= 0) {
    element.style.left = `${record.x}%`;
    element.style.top = `${record.y}%`;
    return;
  }
  const maxX = Math.max(0, 100 - (element.offsetWidth / frameRect.width) * 100);
  const maxY = Math.max(0, 100 - (element.offsetHeight / frameRect.height) * 100);
  record.x = clampNumber(record.x, 0, maxX);
  record.y = clampNumber(record.y, 0, maxY);
  element.style.left = `${record.x}%`;
  element.style.top = `${record.y}%`;
}

function bindStickerDrag(element, record, frame) {
  element.addEventListener("pointerdown", (event) => {
    if (record.locked || event.target.closest(".sticker-tools, .sticker-resize")) {
      return;
    }
    event.preventDefault();
    const frameRect = frame.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = record.x;
    const originY = record.y;
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable for some synthetic events.
    }
    element.classList.add("is-dragging");

    const move = (moveEvent) => {
      record.x = originX + ((moveEvent.clientX - startX) / frameRect.width) * 100;
      record.y = originY + ((moveEvent.clientY - startY) / frameRect.height) * 100;
      placeSticker(element, record, frame);
    };
    const stop = () => {
      element.classList.remove("is-dragging");
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", stop);
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", stop);
  });
}

function bindStickerResize(handle, element, record, frame) {
  handle.addEventListener("pointerdown", (event) => {
    if (record.locked) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const frameWidth = frame.getBoundingClientRect().width;
    const startX = event.clientX;
    const startWidth = element.offsetWidth;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable for some synthetic events.
    }

    const move = (moveEvent) => {
      const nextWidth = startWidth + (moveEvent.clientX - startX);
      record.width = clampNumber((nextWidth / frameWidth) * 100, 8, 70);
      element.style.width = `${record.width}%`;
      placeSticker(element, record, frame);
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
  });
}

function setupStickerLayer(layer, initial, editable) {
  const frame = layer.parentElement;
  const records = [];

  const append = (source) => {
    const record = {
      src: source.src,
      x: Number.isFinite(Number(source.x)) ? Number(source.x) : 10,
      y: Number.isFinite(Number(source.y)) ? Number(source.y) : 16,
      width: Number.isFinite(Number(source.width)) ? Number(source.width) : 22,
      locked: Boolean(source.locked),
    };
    const element = document.createElement("div");
    element.className = "sticker";
    if (record.locked) {
      element.classList.add("is-locked");
    }
    const image = document.createElement("img");
    image.alt = "";
    image.draggable = false;
    image.src = record.src;
    element.append(image);

    if (editable) {
      const tools = document.createElement("div");
      tools.className = "sticker-tools";
      const lockButton = document.createElement("button");
      lockButton.type = "button";
      lockButton.textContent = record.locked ? "해제" : "고정";
      lockButton.addEventListener("click", () => {
        record.locked = !record.locked;
        element.classList.toggle("is-locked", record.locked);
        lockButton.textContent = record.locked ? "해제" : "고정";
      });

      const replace = document.createElement("label");
      replace.className = "sticker-replace";
      replace.append("변경");
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file || !file.type.startsWith("image/")) {
          fileInput.value = "";
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          record.src = reader.result;
          image.src = record.src;
          image.addEventListener("load", () => placeSticker(element, record, frame), { once: true });
        };
        reader.readAsDataURL(file);
      });
      replace.append(fileInput);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "삭제";
      removeButton.addEventListener("click", () => {
        element.remove();
        const index = records.indexOf(record);
        if (index >= 0) {
          records.splice(index, 1);
        }
      });

      const resize = document.createElement("button");
      resize.type = "button";
      resize.className = "sticker-resize";
      resize.setAttribute("aria-label", "크기 조절");
      tools.append(lockButton, replace, removeButton);
      element.append(tools, resize);
      bindStickerDrag(element, record, frame);
      bindStickerResize(resize, element, record, frame);
    }

    image.addEventListener("load", () => placeSticker(element, record, frame));
    layer.append(element);
    placeSticker(element, record, frame);
    records.push(record);
    return record;
  };

  (initial || []).forEach((sticker) => append(sticker));

  return {
    add(src) {
      if (records.length >= 5) {
        return false;
      }
      const offset = records.length;
      append({
        src,
        x: 8 + offset * 5,
        y: 14 + offset * 7,
        width: 22,
        locked: false,
      });
      return true;
    },
    serialize() {
      return records.map(readSticker);
    },
  };
}
