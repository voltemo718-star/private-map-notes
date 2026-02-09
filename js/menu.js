// js/menu.js

let currentActiveNotes = [];

function initMenu() {
  const sidebar = document.getElementById("sidebar");
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");

  const openArchivedBtn = document.getElementById("openArchivedBtn");
  const archivedOverlay = document.getElementById("archivedOverlay");
  const closeArchivedBtn = document.getElementById("closeArchivedBtn");

  hamburgerBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });

  searchInput.addEventListener("input", () => renderActiveList());
  sortSelect.addEventListener("change", () => renderActiveList());

  openArchivedBtn.addEventListener("click", async () => {
    archivedOverlay.classList.remove("hidden");
    await renderArchivedList();
  });

  closeArchivedBtn.addEventListener("click", () => {
    archivedOverlay.classList.add("hidden");
  });

  // Close overlay when clicking outside card
  archivedOverlay.addEventListener("click", (e) => {
    if (e.target === archivedOverlay) archivedOverlay.classList.add("hidden");
  });

  // Subscribe to active notes updates
  onActiveNotesChanged((notes) => {
    currentActiveNotes = notes || [];
    renderActiveList();
  });
}

function renderActiveList() {
  const list = document.getElementById("activeNotesList");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const sortMode = document.getElementById("sortSelect").value;

  let items = [...currentActiveNotes];

  // Filter
  if (q) {
    items = items.filter(n =>
      (n.title || "").toLowerCase().includes(q) ||
      (n.description || "").toLowerCase().includes(q)
    );
  }

  // Sort
  items.sort((a, b) => compareNotes(a, b, sortMode));

  // Show “few” (scrollable list still, but we can limit initial render)
  const MAX_SHOW = 30;
  items = items.slice(0, MAX_SHOW);

  list.innerHTML = "";

  if (items.length === 0) {
    list.innerHTML = `<div style="padding:10px;opacity:.7;font-size:13px;">No notes</div>`;
    return;
  }

  for (const note of items) {
    const el = document.createElement("div");
    el.className = "note-item";
    el.innerHTML = `
      <div class="note-colorbar" style="background:${escapeHtml(note.color || "red")}"></div>
      <div>
        <p class="note-title">${escapeHtml(note.title || "(no title)")}</p>
        <p class="note-desc">${escapeHtml(shortText(note.description || "", 60))}</p>
      </div>
    `;
    el.addEventListener("click", () => {
      // Zoom + open popup (as you requested)
      zoomAndOpenNote(note);
    });
    list.appendChild(el);
  }
}

async function renderArchivedList() {
  const list = document.getElementById("archivedNotesList");
  list.innerHTML = `<div style="padding:10px;opacity:.7;font-size:13px;">Loading…</div>`;

  try {
    const notes = await loadArchivedNotesOnce();
    notes.sort((a, b) => compareNotes(a, b, "dateDesc"));

    list.innerHTML = "";
    if (notes.length === 0) {
      list.innerHTML = `<div style="padding:10px;opacity:.7;font-size:13px;">No archived notes</div>`;
      return;
    }

    for (const note of notes) {
      const card = document.createElement("div");
      card.className = "archived-card";
      card.innerHTML = `
        <div class="note-colorbar" style="background:${escapeHtml(note.color || "red")}"></div>
        <div>
          <p class="note-title">${escapeHtml(note.title || "(no title)")}</p>
          <p class="note-desc">${escapeHtml(shortText(note.description || "", 90))}</p>
          <div class="archived-actions">
            <button class="btn small" data-action="unarchive">Unarchive</button>
            <button class="btn small" data-action="delete">Delete permanently</button>
          </div>
        </div>
      `;

      card.querySelector('[data-action="unarchive"]').addEventListener("click", async () => {
        await unarchiveNote(note.id);
        await renderArchivedList(); // refresh popout
      });

      card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
        const ok = confirm("Delete permanently? This cannot be undone.");
        if (!ok) return;
        await deleteNotePermanently(note.id);
        await renderArchivedList();
      });

      list.appendChild(card);
    }
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div style="padding:10px;color:#b00020;">Failed to load archived notes</div>`;
  }
}

function compareNotes(a, b, mode) {
  const ta = toMillis(a.createdAt);
  const tb = toMillis(b.createdAt);
  const na = (a.title || "").toLowerCase();
  const nb = (b.title || "").toLowerCase();

  if (mode === "dateAsc") return ta - tb;
  if (mode === "dateDesc") return tb - ta;
  if (mode === "nameAsc") return na.localeCompare(nb);
  if (mode === "nameDesc") return nb.localeCompare(na);
  return 0;
}

function toMillis(ts) {
  // Firestore Timestamp has .toMillis()
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return 0;
}

function shortText(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
