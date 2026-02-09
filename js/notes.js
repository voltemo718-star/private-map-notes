// js/notes.js

let currentUserId = null;

// Keep map markers indexed by noteId
const markersById = new Map();
let unsubscribeActiveNotes = null;

function setUserForNotes(userId) {
  currentUserId = userId;
}

function ensureUser() {
  if (!currentUserId) throw new Error("No userId set for notes.");
}

// Create a new note in Firestore
async function createNote({ lat, lng, title, description, color }) {
  ensureUser();

  const now = firebase.firestore.FieldValue.serverTimestamp();

  const noteDoc = {
    userId: currentUserId,
    title: title || "",
    description: description || "",
    color: color || "red",
    lat,
    lng,
    images: [],          // ✅ important
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  const ref = await db.collection("notes").add(noteDoc);
  return ref.id;
}


function startActiveNotesListener() {
  ensureUser();
  if (unsubscribeActiveNotes) unsubscribeActiveNotes();

  unsubscribeActiveNotes = db.collection("notes")
    .where("userId", "==", currentUserId)
    .where("archived", "==", false)
    .onSnapshot((snapshot) => {
      // Clear markers
      for (const [, marker] of markersById.entries()) marker.remove();
      markersById.clear();

      // Build cache
      activeNotesCache = [];
      snapshot.forEach((doc) => {
        const note = { id: doc.id, ...doc.data() };
        activeNotesCache.push(note);

        const marker = createColoredMarker(note);
        markersById.set(note.id, marker);
      });

      notifyActiveNotes();
    }, (err) => {
      console.error("Active notes listener error:", err);
      alert("Error loading notes. Check Console (F12).");
    });
}



function stopActiveNotesListener() {
  if (unsubscribeActiveNotes) unsubscribeActiveNotes();
  unsubscribeActiveNotes = null;
}

// Marker helpers (uses functions from map.js)
function addOrUpdateMarker(note) {
  // Remove old marker if exists (we’ll recreate simply for now)
  if (markersById.has(note.id)) {
    const old = markersById.get(note.id);
    old.remove();
    markersById.delete(note.id);
  }

  const marker = createColoredMarker(note); // function in map.js
  markersById.set(note.id, marker);
}

function removeMarker(noteId) {
  const marker = markersById.get(noteId);
  if (marker) marker.remove();
  markersById.delete(noteId);
}

// Keep active notes for sidebar
let activeNotesCache = [];
let activeNotesSubscribers = [];

function onActiveNotesChanged(cb) {
  activeNotesSubscribers.push(cb);
  cb(activeNotesCache); // immediate
}

function notifyActiveNotes() {
  activeNotesSubscribers.forEach((cb) => cb(activeNotesCache));
}

// Update your snapshot listener to refresh cache
// In startActiveNotesListener(), inside onSnapshot(), after processing snapshot:

async function loadArchivedNotesOnce() {
  ensureUser();
  const snap = await db.collection("notes")
    .where("userId", "==", currentUserId)
    .where("archived", "==", true)
    .get();

  const notes = [];
  snap.forEach((doc) => notes.push({ id: doc.id, ...doc.data() }));
  return notes;
}

async function unarchiveNote(noteId) {
  ensureUser();
  await db.collection("notes").doc(noteId).update({
    archived: false,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function deleteNotePermanently(noteId) {
  ensureUser();
  await db.collection("notes").doc(noteId).delete();
}

async function updateNote(noteId, patch) {
  ensureUser();
  patch.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  await db.collection("notes").doc(noteId).update(patch);
}

async function archiveNote(noteId) {
  ensureUser();
  await updateNote(noteId, { archived: true });
}

async function addImagesToNote(noteId, imagesArr) {
  ensureUser();
  if (!imagesArr || imagesArr.length === 0) return;

  await db.collection("notes").doc(noteId).update({
    images: firebase.firestore.FieldValue.arrayUnion(...imagesArr),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function removeImageFromNote(noteId, publicId) {
  ensureUser();

  const ref = db.collection("notes").doc(noteId);
  const snap = await ref.get();
  const data = snap.data() || {};
  const images = Array.isArray(data.images) ? data.images : [];

  const next = images.filter(img => img.publicId !== publicId);

  await ref.update({
    images: next,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}
