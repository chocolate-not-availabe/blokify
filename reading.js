// reading.js

const API_BASE = "https://blokify.onrender.com";

// ----------------------
// Logged-in user (for taps & progress)
// ----------------------
const rawUser = localStorage.getItem("blokifyUser");
const currentUser = rawUser ? JSON.parse(rawUser) : null;

if (!currentUser) {
  // not logged in → go to auth
  window.location.href = "auth.html";
}

const USER_ID = currentUser.id;

// ----------------------
// Settings (reading text size)
// ----------------------
function settingsKey() {
  return `blokifySettings_${USER_ID}`;
}

function loadReadingSettings() {
  const rawSettings = localStorage.getItem(settingsKey());
  if (!rawSettings) {
    return { readingTextSize: "normal" };
  }
  try {
    return JSON.parse(rawSettings);
  } catch (e) {
    console.error("Failed to parse settings:", e);
    return { readingTextSize: "normal" };
  }
}

// ----------------------
// DOM elements
// ----------------------
const storyTitleEl = document.getElementById("storyTitle");
const readingWrapper = document.getElementById("readingWrapper");
const hintOverlay = document.getElementById("hintOverlay");
const blocksContainer = document.getElementById("blocksContainer");

// Get storyId from URL
const params = new URLSearchParams(window.location.search);
const storyId = params.get("storyId") || null;

storyTitleEl.textContent = "Reading" + (storyId ? " — " + storyId : "");

// Characters (for chat blocks — local only for now)
const characters = [
  { id: "c1", name: "Maya", color: "#a876ff" },
  { id: "c2", name: "Jace", color: "#ff8a65" }
];

// All story blocks from backend
let blocks = [];

// Index of last block shown (-1 = nothing shown yet)
let currentIndex = -1;

// ----------------------
// Helper functions
// ----------------------

function applyReadingTextSize() {
  const settings = loadReadingSettings();
  const size = settings.readingTextSize || "normal";

  if (!blocksContainer) return;

  if (size === "small") {
    blocksContainer.style.fontSize = "13px";
  } else if (size === "large") {
    blocksContainer.style.fontSize = "18px";
  } else {
    // normal
    blocksContainer.style.fontSize = "15px";
  }
}

function findCharacterById(id) {
  return characters.find(c => c.id === id) || null;
}

function createBlockElement(block) {
  const blockEl = document.createElement("div");
  blockEl.className = "block";
  blockEl.dataset.blockId = block.id;

  if (block.type === "text") {
    const p = document.createElement("p");
    p.className = "block-text";
    p.textContent = block.content || "";
    blockEl.appendChild(p);
  } else if (block.type === "chat") {
    blockEl.classList.add("chat-block");

    const chatWrap = document.createElement("div");
    chatWrap.className = "chat-content";

    const char = findCharacterById(block.characterId);
    const firstLetter = char ? char.name.charAt(0).toUpperCase() : "?";
    const color = char ? char.color : "#555";

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "chat-avatar";

    const avatarCircle = document.createElement("div");
    avatarCircle.className = "avatar-circle";
    avatarCircle.style.backgroundColor = color;
    avatarCircle.textContent = firstLetter;
    avatarWrap.appendChild(avatarCircle);

    const name = document.createElement("h6");
    name.className = "chat-name";
    name.textContent = char ? char.name : "Unknown";
    avatarWrap.appendChild(name);

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.textContent = block.content || "";

    chatWrap.appendChild(avatarWrap);
    chatWrap.appendChild(bubble);

    blockEl.appendChild(chatWrap);
  } else if (block.type === "image") {
    blockEl.classList.add("image-block");
    const img = document.createElement("img");
    if (block.imageUrl) {
      img.src = block.imageUrl;
    } else {
      img.style.backgroundColor = "#181820";
      img.style.height = "220px";
    }
    blockEl.appendChild(img);
  }

  return blockEl;
}

// Render all blocks up to index (inclusive)
function renderBlocksUpTo(index) {
  blocksContainer.innerHTML = "";

  if (index >= 0) {
    for (let i = 0; i <= index && i < blocks.length; i++) {
      const blockEl = createBlockElement(blocks[i]);
      blocksContainer.appendChild(blockEl);
    }
  }

  if (index >= 0 && index === blocks.length - 1) {
    const end = document.createElement("div");
    end.className = "end-message";
    end.textContent = "End of story.";
    blocksContainer.appendChild(end);
  }

  blocksContainer.scrollTop = blocksContainer.scrollHeight;
}

// ----------------------
// Save reading progress (also counts taps in backend)
// ----------------------
async function saveProgress(index) {
  if (!storyId || !USER_ID) return;
  try {
    await fetch(`${API_BASE}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: USER_ID,
        storyId: storyId,
        lastBlockIndex: index
      })
    });
  } catch (err) {
    console.error("Failed to save progress:", err);
  }
}

// ----------------------
// Show next block on tap
// ----------------------
async function showNextBlock() {
  if (!blocks.length) return;

  // Remove old "End of story" if we are continuing
  const endMsg = document.querySelector(".end-message");
  if (endMsg) endMsg.remove();

  if (currentIndex < blocks.length - 1) {
    currentIndex += 1;

    // First tap after opening: hide hint overlay
    if (currentIndex === 0 && hintOverlay) {
      hintOverlay.style.display = "none";
    }

    const blockEl = createBlockElement(blocks[currentIndex]);
    blocksContainer.appendChild(blockEl);
    blocksContainer.scrollTop = blocksContainer.scrollHeight;

    // Save progress (this call also counts a tap)
    await saveProgress(currentIndex);

    // If this is now the last known block, show end message
    if (currentIndex === blocks.length - 1) {
      const end = document.createElement("div");
      end.className = "end-message";
      end.textContent = "End of story.";
      blocksContainer.appendChild(end);
      blocksContainer.scrollTop = blocksContainer.scrollHeight;
    }
  }
}

// ----------------------
// Initial load from backend
// ----------------------
async function loadBlocksAndProgress() {
  if (!storyId) {
    console.warn("No storyId in URL, nothing to read.");
    return;
  }

  // Apply reading settings (text size) once at start
  applyReadingTextSize();

  try {
    // 1) blocks
    const resBlocks = await fetch(`${API_BASE}/stories/${encodeURIComponent(storyId)}/blocks`);
    if (!resBlocks.ok) {
      console.error("Failed to get blocks:", resBlocks.status);
      return;
    }
    const blocksData = await resBlocks.json();
    blocks = blocksData.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    // 2) progress
    const resProgress = await fetch(
      `${API_BASE}/progress/${encodeURIComponent(storyId)}?userId=${encodeURIComponent(USER_ID)}`
    );

    let lastIndex = -1;
    if (resProgress.ok) {
      const prog = await resProgress.json();
      if (typeof prog.lastBlockIndex === "number") {
        lastIndex = prog.lastBlockIndex;
      }
    }

    if (lastIndex >= blocks.length) {
      lastIndex = blocks.length - 1;
    }

    currentIndex = lastIndex;

    if (currentIndex >= 0) {
      if (hintOverlay) {
        hintOverlay.style.display = "none";
      }
      renderBlocksUpTo(currentIndex);
    } else {
      if (hintOverlay) {
        hintOverlay.style.display = "flex"; // "Tap to read"
      }
    }
  } catch (err) {
    console.error("Error loading reading data:", err);
  }
}

// ----------------------
// Tap / touch handlers
// ----------------------
readingWrapper.addEventListener("click", () => {
  showNextBlock();
});

readingWrapper.addEventListener("touchstart", (e) => {
  e.preventDefault();
  showNextBlock();
}, { passive: false });

// ----------------------
// Init
// ----------------------
loadBlocksAndProgress();
