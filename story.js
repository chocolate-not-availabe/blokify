// story.js

const API_BASE = "https://blokify.onrender.com";

// Elements
const coverInput = document.getElementById("coverInput");
const coverImage = document.getElementById("coverImage");
const coverPlaceholder = document.getElementById("coverPlaceholder");

const titleInput = document.getElementById("titleInput");
const descInput = document.getElementById("descInput");
const genreInput = document.getElementById("genreInput");
const tagsInput = document.getElementById("tagsInput");
const originalSwitch = document.getElementById("originalSwitch");

const saveButton = document.getElementById("saveButton");
const readButton = document.getElementById("readButton");

// Get storyId from URL, e.g. story.html?storyId=s_1234
const params = new URLSearchParams(window.location.search);
let storyId = params.get("storyId") || null;

// -----------------------------
// Load existing story (edit)
// -----------------------------
async function loadStoryIfNeeded() {
  if (!storyId) {
    console.log("Creating new story.");
    return;
  }

  console.log("Editing story:", storyId);

  try {
    const res = await fetch(`${API_BASE}/stories/${encodeURIComponent(storyId)}`);
    if (!res.ok) {
      console.warn("Failed to load story details, status:", res.status);
      return;
    }

    const story = await res.json();
    titleInput.value = story.title || "";
    descInput.value = story.description || "";
    genreInput.value = story.genre || "";
    tagsInput.value = (story.tags || []).join(", ");
    originalSwitch.checked = !!story.original;

    // Later: coverUrl preview
    if (story.coverUrl) {
      coverImage.src = story.coverUrl;
      coverImage.style.display = "block";
      coverPlaceholder.style.display = "none";
    }
  } catch (err) {
    console.error("Error loading story:", err);
  }
}

loadStoryIfNeeded();

// -----------------------------
// Cover preview (front-end only)
// -----------------------------
if (coverInput) {
  coverInput.addEventListener("change", () => {
    const file = coverInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      coverImage.src = e.target.result;
      coverImage.style.display = "block";
      coverPlaceholder.style.display = "none";
    };
    reader.readAsDataURL(file); // preview only
  });
}

// -----------------------------
// Helper: save story via backend
// -----------------------------
async function saveStoryToBackend(payload) {
  const res = await fetch(`${API_BASE}/stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to save story");
  }

  return await res.json();
}

// -----------------------------
// Save & Go to Writing
// -----------------------------
if (saveButton) {
  saveButton.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const genre = genreInput.value.trim();
    const tags = tagsInput.value
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
    const original = originalSwitch.checked;

    if (!title) {
      alert("Title is required.");
      return;
    }

    const payload = {
      id: storyId || undefined,  // if present → update; else create
      title,
      description,
      genre,
      tags,
      original,
      authorId: "user123",       // placeholder
      coverUrl: ""               // later: real upload
    };

    console.log("Sending to backend:", payload);

    try {
      const saved = await saveStoryToBackend(payload);
      console.log("Saved story:", saved);

      // Update storyId if it was new
      storyId = saved.id || storyId;
      if (!storyId) {
        alert("Saved but no id returned. Check backend.");
        return;
      }

      // Go to writing screen for this story
      window.location.href = `writing.html?storyId=${encodeURIComponent(storyId)}`;
    } catch (err) {
      console.error(err);
      alert("Failed to save story: " + err.message);
    }
  });
}

// -----------------------------
// Read story button
// -----------------------------
if (readButton) {
  readButton.addEventListener("click", () => {
    if (!storyId) {
      alert("You need to save the story first before reading.");
      return;
    }
    window.location.href = `reading.html?storyId=${encodeURIComponent(storyId)}`;
  });
}
