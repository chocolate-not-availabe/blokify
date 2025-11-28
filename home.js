// home.js

const API_BASE = "https://blokify.onrender.com";

// Get current logged-in user (saved by auth.js)
const rawUser = localStorage.getItem("blokifyUser");
const currentUser = rawUser ? JSON.parse(rawUser) : null;

if (!currentUser) {
  // Not logged in → go to auth
  window.location.href = "auth.html";
}

const USER_ID = currentUser.id;

const yourStoriesRow = document.getElementById("yourStoriesRow");
const readingRow = document.getElementById("readingRow");
const newbiesRow = document.getElementById("newbiesRow");

// Helper: create a story card element
function createStoryCard(story, options = {}) {
  const { showWriteButton = false } = options;

  const card = document.createElement("div");
  card.className = "story-card";

  // ---- Cover image at top ----
  const coverWrap = document.createElement("div");
  coverWrap.className = "story-card-cover";

  if (story.coverUrl) {
    const img = document.createElement("img");
    img.src = story.coverUrl;
    img.alt = story.title || "Cover";
    coverWrap.appendChild(img);
  } else {
    const placeholder = document.createElement("span");
    placeholder.style.fontSize = "11px";
    placeholder.style.color = "#555";
    placeholder.textContent = "No cover";
    coverWrap.appendChild(placeholder);
  }

  card.appendChild(coverWrap);

  // ---- Title (name) ----
  const title = document.createElement("h3");
  title.className = "story-card-title";
  title.textContent = story.title || "Untitled";
  // Click title -> Story Details
  title.addEventListener("click", () => {
    window.location.href = `story.html?storyId=${encodeURIComponent(story.id)}`;
  });
  card.appendChild(title);

  // ---- Status ----
  const meta = document.createElement("div");
  meta.className = "story-card-meta";
  const status = story.status || "draft";
  meta.textContent = status === "published" ? "Published" : "Draft";
  card.appendChild(meta);

  // ---- Tags ----
  if (story.tags && story.tags.length) {
    const tags = document.createElement("div");
    tags.className = "story-card-tags";
    tags.textContent = story.tags.slice(0, 3).join(", ");
    card.appendChild(tags);
  }

  // ---- Buttons ----
  const buttonsRow = document.createElement("div");
  buttonsRow.className = "story-card-buttons";

  if (showWriteButton) {
    const writeBtn = document.createElement("button");
    writeBtn.className = "story-btn";
    writeBtn.textContent = "Write";
    writeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `writing.html?storyId=${encodeURIComponent(story.id)}`;
    });
    buttonsRow.appendChild(writeBtn);
  }

  const readBtn = document.createElement("button");
  readBtn.className = "story-btn primary";
  readBtn.textContent = "Read";
  readBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    window.location.href = `reading.html?storyId=${encodeURIComponent(story.id)}`;
  });
  buttonsRow.appendChild(readBtn);

  card.appendChild(buttonsRow);

  return card;
}

// Load Your Stories (published by this user)
async function loadYourStories() {
  yourStoriesRow.innerHTML = '<p class="row-empty">Loading...</p>';
  try {
    const res = await fetch(
      `${API_BASE}/stories/your?userId=${encodeURIComponent(USER_ID)}`
    );
    if (!res.ok) throw new Error("Failed to load your stories");
    const data = await res.json();

    yourStoriesRow.innerHTML = "";
    if (!data.length) {
      yourStoriesRow.innerHTML = '<p class="row-empty">No stories yet. Start one?</p>';
      return;
    }

    data.forEach(story =>
      yourStoriesRow.appendChild(
        createStoryCard(story, { showWriteButton: true })
      )
    );
  } catch (err) {
    console.error(err);
    yourStoriesRow.innerHTML = '<p class="row-empty">Error loading your stories.</p>';
  }
}

// Load Reading stories (stories where user has progress)
async function loadReadingStories() {
  readingRow.innerHTML = '<p class="row-empty">Loading...</p>';
  try {
    const res = await fetch(
      `${API_BASE}/stories/reading?userId=${encodeURIComponent(USER_ID)}`
    );
    if (!res.ok) throw new Error("Failed to load reading stories");
    const data = await res.json();

    readingRow.innerHTML = "";
    if (!data.length) {
      readingRow.innerHTML =
        '<p class="row-empty">You haven&#39;t started reading yet.</p>';
      return;
    }

    data.forEach(story =>
      readingRow.appendChild(
        createStoryCard(story, { showWriteButton: false })
      )
    );
  } catch (err) {
    console.error(err);
    readingRow.innerHTML = '<p class="row-empty">Error loading reading list.</p>';
  }
}

// Load Newbies (latest published)
async function loadNewbies() {
  newbiesRow.innerHTML = '<p class="row-empty">Loading...</p>';
  try {
    const res = await fetch(`${API_BASE}/stories/newbies`);
    if (!res.ok) throw new Error("Failed to load newbies");
    const data = await res.json();

    newbiesRow.innerHTML = "";
    if (!data.length) {
      newbiesRow.innerHTML = '<p class="row-empty">No stories yet.</p>';
      return;
    }

    data.forEach(story =>
      newbiesRow.appendChild(
        createStoryCard(story, { showWriteButton: false })
      )
    );
  } catch (err) {
    console.error(err);
    newbiesRow.innerHTML = '<p class="row-empty">Error loading newbies.</p>';
  }
}

// Init
loadYourStories();
loadReadingStories();
loadNewbies();
