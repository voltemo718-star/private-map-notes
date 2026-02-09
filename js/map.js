// js/map.js

let map;
let lastPressedLatLng = null;
let popupMode = "create"; // "create" or "edit"
let editingNoteId = null;
let selectedImageFiles = [];
let selectedPreviews = []; // local preview objects for selected files
let currentOpenedNote = null; // set this in openViewNotePopup(note)


function initMap() {
  map = L.map("map", { zoomControl: true }).setView([45.2671, 19.8335], 13); //Novi Sad

  // Free map tiles (OpenStreetMap)
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // PC: right-click
  map.on("contextmenu", (e) => {
    openCreateNotePopup(e.latlng);
  });

  // Phone: long-press
  enableLongPress(map.getContainer(), (screenPoint) => {
    const latlng = map.containerPointToLatLng(screenPoint);
    openCreateNotePopup(latlng);
  });
}

function zoomAndOpenNote(note) {
  map.setView([note.lat, note.lng], Math.max(map.getZoom(), 16));
  openViewNotePopup(note);
}

function rebuildSelectedPreviews() {
  // revoke old blob URLs
  selectedPreviews.forEach(p => {
    if (p._blobUrl) URL.revokeObjectURL(p._blobUrl);
    if (p._blobThumbUrl) URL.revokeObjectURL(p._blobThumbUrl);
  });

  selectedPreviews = selectedImageFiles.map((file) => {
    const url = URL.createObjectURL(file);
    // use same url for thumb/full in preview
    return { fullUrl: url, thumbUrl: url, _local: true, _blobUrl: url, _blobThumbUrl: url };
  });
}

function refreshThumbsUI() {
  const existing = (currentOpenedNote && currentOpenedNote.images) ? currentOpenedNote.images : [];
  renderThumbnails([...existing, ...selectedPreviews]);
}

function resetImageSelectionUI() {
  selectedImageFiles = [];
  rebuildSelectedPreviews();
  const input = document.getElementById("noteImages");
  if (input) input.value = "";
  refreshThumbsUI();
}


function openCreateNotePopup(latlng) {
  lastPressedLatLng = latlng;

  popupMode = "create";
  editingNoteId = null;

  currentOpenedNote = null;
  renderThumbnails([]); // optional, resetImageSelectionUI already refreshes

  selectedImageFiles = [];
  document.getElementById("noteImages").value = "";
  renderThumbnails([]);


  document.getElementById("noteTitle").value = "";
  document.getElementById("noteDesc").value = "";
  document.getElementById("noteColor").value = "red";

  updatePopupButtons();
  showPopup();
}

function showPopup() {
  document.getElementById("notePopup").classList.remove("hidden");
}

function hidePopup() {
  document.getElementById("notePopup").classList.add("hidden");
}

function createColoredMarker(note) {
  const latlng = [note.lat, note.lng];

  // Simple colored circle marker (easy and clean)
  const marker = L.circleMarker(latlng, {
    radius: 9,
    weight: 2,
    fillOpacity: 0.9
  });

  // Apply color
  marker.setStyle({ color: note.color, fillColor: note.color });

  // Click marker -> open popup with note info (edit later)
  marker.on("click", () => {
    openViewNotePopup(note);
  });

  marker.addTo(map);
  return marker;
}

function openViewNotePopup(note) {
  lastPressedLatLng = { lat: note.lat, lng: note.lng };

  popupMode = "edit";
  editingNoteId = note.id;

  currentOpenedNote = note;
  resetImageSelectionUI();   // clears new selections but keeps existing thumbs visible
  renderThumbnails(note.images || []);


  selectedImageFiles = [];
  document.getElementById("noteImages").value = "";
  renderThumbnails(note.images || []);


  document.getElementById("noteTitle").value = note.title || "";
  document.getElementById("noteDesc").value = note.description || "";
  document.getElementById("noteColor").value = note.color || "red";

  updatePopupButtons();
  showPopup();
}

function updatePopupButtons() {
  const archiveBtn = document.getElementById("archiveNoteBtn");
  const deleteBtn = document.getElementById("deleteNoteBtn");

  const isEdit = popupMode === "edit";
  archiveBtn.style.display = isEdit ? "inline-block" : "none";
  deleteBtn.style.display = isEdit ? "inline-block" : "none";
}


// Simple long-press detector (mobile-friendly)
function enableLongPress(element, onLongPress) {
  let timer = null;
  let start = null;
  const LONG_PRESS_MS = 450; // feels good on phones
  const MOVE_CANCEL_PX = 10;

  element.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY };

    timer = setTimeout(() => {
      // Convert screen coords to container point
      const rect = element.getBoundingClientRect();
      const point = L.point(start.x - rect.left, start.y - rect.top);
      onLongPress(point);
    }, LONG_PRESS_MS);
  }, { passive: true });

  element.addEventListener("touchmove", (e) => {
    if (!timer || !start || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      clearTimeout(timer);
      timer = null;
    }
  }, { passive: true });

  element.addEventListener("touchend", () => {
    if (timer) clearTimeout(timer);
    timer = null;
    start = null;
  });
}

function initPopupUI() {
  const saveBtn = document.getElementById("saveNoteBtn");
  const archiveBtn = document.getElementById("archiveNoteBtn");
  const deleteBtn = document.getElementById("deleteNoteBtn");
  const closeBtn = document.getElementById("closePopupBtn");
  const fileInput = document.getElementById("noteImages");

  // Close popup
  closeBtn.onclick = () => {
    cleanupLocalThumbs();
    hidePopup();
  };

  // Track selected files (for upload on Save)
  fileInput.onchange = (e) => {
    const newFiles = Array.from(e.target.files || []);

    // Add (accumulate) files instead of replacing
    selectedImageFiles = [...selectedImageFiles, ...newFiles];

    rebuildSelectedPreviews();
    refreshThumbsUI();

    // allow picking the same file again later
    fileInput.value = "";
  };



  // SAVE (create or edit) + upload images to Cloudinary + store URLs in Firestore
  saveBtn.onclick = async () => {
    if (popupMode === "create" && !lastPressedLatLng) return;
    if (popupMode === "edit" && !editingNoteId) return;

    saveBtn.disabled = true;
    const oldText = saveBtn.textContent;
    saveBtn.textContent = "Saving…";

    const title = document.getElementById("noteTitle").value.trim();
    const description = document.getElementById("noteDesc").value.trim();
    const color = document.getElementById("noteColor").value;
 
    try {
      if (popupMode === "create") {
        // CREATE
        const noteId = await createNote({
          lat: lastPressedLatLng.lat,
          lng: lastPressedLatLng.lng,
          title,
          description,
          color
        });

        if (selectedImageFiles.length) {
          const imgs = await uploadImagesForNote({
          files: selectedImageFiles,
          onProgress: ({ current, total }) => {
            saveBtn.textContent = `Uploading ${current}/${total}…`;
           }
          });
          await addImagesToNote(noteId, imgs);
        }

      } else if (popupMode === "edit") {
        // EDIT
        await updateNote(editingNoteId, { title, description, color });

        if (selectedImageFiles.length) {
          const imgs = await uploadImagesForNote({ files: selectedImageFiles });
          await addImagesToNote(editingNoteId, imgs);
        }
      }

      resetImageSelectionUI();
      hidePopup();

    } catch (err) {
      console.error(err);
      alert(err.message || "Save failed");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = oldText;
    }
  };


  // ARCHIVE (only in edit mode)
  archiveBtn.onclick = async () => {
    if (!editingNoteId) return;
    try {
      await archiveNote(editingNoteId);
      hidePopup();
    } catch (err) {
      console.error(err);
      alert(err.message || "Archive failed");
    }
  };

  // DELETE permanently (only in edit mode)
  deleteBtn.onclick = async () => {
    if (!editingNoteId) return;
    const ok = confirm("Delete permanently? This cannot be undone.");
    if (!ok) return;

    try {
      await deleteNotePermanently(editingNoteId);
      hidePopup();
    } catch (err) {
      console.error(err);
      alert(err.message || "Delete failed");
    }
  };
}

function cleanupLocalThumbs() {
  const thumbs = document.getElementById("thumbs");
  thumbs.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || "";
    if (src.startsWith("blob:")) URL.revokeObjectURL(src);
  });
}


function clearPopupFields() {
  document.getElementById("noteTitle").value = "";
  document.getElementById("noteDesc").value = "";
  document.getElementById("noteColor").value = "red";
}

function renderThumbnails(images) {
  const thumbs = document.getElementById("thumbs");
  thumbs.innerHTML = "";

  const arr = images || [];
  arr.forEach((imgObj, idx) => {
    const wrap = document.createElement("div");
    wrap.style.position = "relative";
    wrap.style.width = "64px";
    wrap.style.height = "64px";

    const el = document.createElement("img");
    el.className = "thumb";
    el.src = imgObj.thumbUrl || imgObj.fullUrl;
    el.alt = "thumb";
    el.addEventListener("click", () => openGallery(arr, idx));

    wrap.appendChild(el);

    // Show delete only for saved images (Cloudinary ones) while editing a note
    if (editingNoteId && imgObj.publicId) {
      const x = document.createElement("button");
      x.textContent = "✕";
      x.style.position = "absolute";
      x.style.top = "4px";
      x.style.right = "4px";
      x.style.border = "1px solid #fff";
      x.style.background = "rgba(0,0,0,0.55)";
      x.style.color = "white";
      x.style.borderRadius = "10px";
      x.style.cursor = "pointer";
      x.style.padding = "2px 6px";

      x.onclick = async (ev) => {
        ev.stopPropagation();
        if (!editingNoteId || !imgObj.publicId) return;

        try {
          await removeImageFromNote(editingNoteId, imgObj.publicId);

          // Update UI immediately (don’t wait for listener)
          if (currentOpenedNote && Array.isArray(currentOpenedNote.images)) {
            currentOpenedNote.images = currentOpenedNote.images.filter(
              (im) => im.publicId !== imgObj.publicId
            );
          }
          refreshThumbsUI(); // or renderThumbnails(currentOpenedNote.images)

        } catch (err) {
          console.error(err);
          alert(err.message || "Failed to remove image");
        }
      };


      wrap.appendChild(x);
    }

    thumbs.appendChild(wrap);
  });
}


