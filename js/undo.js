// js/undo.js
let undoTimer = null;
let lastUndoAction = null;

function showUndo(message, onUndo) {
  clearUndo();

  const bar = document.getElementById("undoBar");
  const msg = document.getElementById("undoMsg");
  const btn = document.getElementById("undoBtn");

  msg.textContent = message;
  lastUndoAction = onUndo;

  bar.classList.remove("hidden");

  btn.onclick = async () => {
    try {
      await lastUndoAction?.();
    } finally {
      clearUndo();
    }
  };

  undoTimer = setTimeout(() => clearUndo(), 8000);
}

function clearUndo() {
  const bar = document.getElementById("undoBar");
  if (bar) bar.classList.add("hidden");
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = null;
  lastUndoAction = null;
}
