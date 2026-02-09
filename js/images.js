// js/images.js (Cloudinary)

// CONFIG — change these two
const CLOUDINARY_CLOUD_NAME = "dhgblxzmt";
const CLOUDINARY_UPLOAD_PRESET = "map-notes";

// Upload images to Cloudinary
async function uploadImagesForNote({ files, onProgress }) {
  if (!files || files.length === 0) return [];

  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    onProgress?.({ current: i + 1, total: files.length, fileName: file.name });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "map-notes");

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error("Cloudinary upload failed: " + text);
    }

    const data = await res.json();
    results.push({
      fullUrl: data.secure_url,
      thumbUrl: data.secure_url.replace("/upload/", "/upload/w_300/"),
      publicId: data.public_id
    });
  }

  return results;
}


/* ---------- Gallery ---------- */
let galleryImages = [];
let galleryIndex = 0;

function initGallery() {
  const overlay = document.getElementById("gallery");
  const img = document.getElementById("galleryImg");

  document.getElementById("galleryClose").onclick = closeGallery;
  document.getElementById("galleryPrev").onclick = () => showGalleryAt(galleryIndex - 1);
  document.getElementById("galleryNext").onclick = () => showGalleryAt(galleryIndex + 1);

  // Close when clicking the dark background
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeGallery();
  });

  // Touch swipe (phones / responsive mode)
  let startX = null;
  img.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
  }, { passive: true });

  img.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const endX = e.changedTouches[0].clientX;
    const dx = endX - startX;
    startX = null;

    if (Math.abs(dx) < 40) return;
    if (dx > 0) showGalleryAt(galleryIndex - 1);
    else showGalleryAt(galleryIndex + 1);
  }, { passive: true });

  // Mouse drag swipe (so inspect/mobile testing works without a phone)
  let mouseDownX = null;

  img.addEventListener("mousedown", (e) => {
    mouseDownX = e.clientX;
  });

  window.addEventListener("mouseup", (e) => {
    if (mouseDownX === null) return;
    const dx = e.clientX - mouseDownX;
    mouseDownX = null;

    if (Math.abs(dx) < 40) return;
    if (dx > 0) showGalleryAt(galleryIndex - 1);
    else showGalleryAt(galleryIndex + 1);
  });
}


function openGallery(images, start = 0) {
  galleryImages = images || [];
  galleryIndex = start;
  document.getElementById("gallery").classList.remove("hidden");
  showGalleryAt(galleryIndex);
}

function closeGallery() {
  document.getElementById("gallery").classList.add("hidden");
}

function showGalleryAt(i) {
  if (!galleryImages.length) return;
  galleryIndex = (i + galleryImages.length) % galleryImages.length;
  document.getElementById("galleryImg").src = galleryImages[galleryIndex].fullUrl;
}
