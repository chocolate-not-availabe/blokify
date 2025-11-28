// writing.js

const API_BASE = "https://blokify.onrender.com";

// ----------------------
// Story + basic state
// ----------------------

const params = new URLSearchParams(window.location.search);
const storyId = params.get("storyId") || null; // should be real now

const storyTitleEl = document.getElementById("storyTitle");
storyTitleEl.textContent = "Writing" + (storyId ? " — " + storyId : "");

// Menu elements
const menuButton = document.getElementById("menuButton");
const menuDropdown = document.getElementById("menuDropdown");
const menuSave = document.getElementById("menuSave");
const menuPublish = document.getElementById("menuPublish");
const menuManage = document.getElementById("menuManage");

// Containers, toolbar, dialogs, etc.
const blocksContainer = document.getElementById("blocksContainer");
const toolbarButtons = document.querySelectorAll(".tool-btn");

const textDialog = document.getElementById("textDialog");
const textDialogTitle = document.getElementById("textDialogTitle");
const textDialogInput = document.getElementById("textDialogInput");
const textDialogCancel = document.getElementById("textDialogCancel");
const textDialogSave = document.getElementById("textDialogSave");

const chatDialog = document.getElementById("chatDialog");
const chatCharacterSelect = document.getElementById("chatCharacterSelect");
const chatMessageInput = document.getElementById("chatMessageInput");
const chatDialogCancel = document.getElementById("chatDialogCancel");
const chatDialogSave = document.getElementById("chatDialogSave");

const charactersDialog = document.getElementById("charactersDialog");
const charactersList = document.getElementById("charactersList");
const newCharacterName = document.getElementById("newCharacterName");
const addCharacterButton = document.getElementById("addCharacterButton");
const charactersDialogClose = document.getElementById("charactersDialogClose");

const imageInput = document.getElementById("imageInput");

const blockMenu = document.getElementById("blockMenu");
const blockMenuEdit = document.getElementById("blockMenuEdit");
const blockMenuDelete = document.getElementById("blockMenuDelete");

// Characters (still local-only)
let characters = [
  { id: "c1", name: "Maya", color: "#a876ff" },
  { id: "c2", name: "Jace", color: "#ff8a65" }
];

// Blocks now come from backend
let blocks = [];

// State
let currentEditingBlockId = null;
let currentMenuBlockId = null;

// ----------------------
// Helpers
// ----------------------

function findCharacterById(id) {
  return characters.find(c => c.id === id) || null;
}

function findBlockById(id) {
  return blocks.find(b => b.id === id) || null;
}

// ----------------------
// Backend helpers
// ----------------------

async function fetchBlocksFromBackend() {
  if (!storyId) {
    console.warn("No storyId, starting with empty blocks.");
    blocks = [];
    renderBlocks();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/stories/${encodeURIComponent(storyId)}/blocks`);
    if (!res.ok) {
      console.error("Failed to fetch blocks, status:", res.status);
      blocks = [];
      renderBlocks();
      return;
    }
    const data = await res.json();
    // sort by index just in case
    blocks = data.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    renderBlocks();
  } catch (err) {
    console.error("Error loading blocks:", err);
    blocks = [];
    renderBlocks();
  }
}

async function createBlockOnBackend(blockPayload) {
  if (!storyId) {
    alert("No storyId in URL. Use Story Details to create a story first.");
    return null;
  }

  const res = await fetch(`${API_BASE}/stories/${encodeURIComponent(storyId)}/blocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(blockPayload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to create block");
  }

  return await res.json();
}

async function updateBlockOnBackend(blockId, payload) {
  const res = await fetch(`${API_BASE}/blocks/${encodeURIComponent(blockId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to update block");
  }

  return await res.json();
}

async function deleteBlockOnBackend(blockId) {
  const res = await fetch(`${API_BASE}/blocks/${encodeURIComponent(blockId)}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to delete block");
  }

  return await res.json();
}

// ----------------------
// Render blocks
// ----------------------

function renderBlocks() {
  blocksContainer.innerHTML = "";

  blocks.forEach(block => {
    const blockEl = document.createElement("div");
    blockEl.className = "block";
    blockEl.dataset.blockId = block.id;

    if (block.type === "chat") {
      blockEl.classList.add("chat-block");
    } else if (block.type === "image") {
      blockEl.classList.add("image-block");
    }

    if (block.type === "text") {
      const p = document.createElement("p");
      p.className = "block-text";
      p.textContent = block.content || "";
      blockEl.appendChild(p);
    } else if (block.type === "chat") {
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
      const img = document.createElement("img");
      img.src = block.imageUrl || "";
      blockEl.appendChild(img);
    }

    // Click block (desktop) -> Edit/Delete menu
    blockEl.addEventListener("click", (e) => {
      const x = e.clientX;
      const y = e.clientY;
      openBlockMenu(block.id, x, y);
    });

    // Long press (mobile)
    attachLongPressHandler(blockEl, block.id);

    blocksContainer.appendChild(blockEl);
  });
}

// ----------------------
// Long press (mobile)
// ----------------------

function attachLongPressHandler(el, blockId) {
  let timer = null;

  function startPress(e) {
    if (e.type === "touchstart") {
      timer = setTimeout(() => {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        openBlockMenu(blockId, x, y);
      }, 500);
    }
  }

  function cancelPress() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  el.addEventListener("touchstart", startPress);
  el.addEventListener("touchend", cancelPress);
  el.addEventListener("touchmove", cancelPress);
  el.addEventListener("touchcancel", cancelPress);
}

// ----------------------
// Block menu
// ----------------------

function openBlockMenu(blockId, x, y) {
  currentMenuBlockId = blockId;
  blockMenu.style.left = x + "px";
  blockMenu.style.top = y + "px";
  blockMenu.classList.remove("hidden");
}

function closeBlockMenu() {
  blockMenu.classList.add("hidden");
  currentMenuBlockId = null;
}

blockMenuEdit.addEventListener("click", () => {
  if (!currentMenuBlockId) return;
  const block = findBlockById(currentMenuBlockId);
  if (!block) return;

  if (block.type === "text") {
    openTextDialog(block);
  } else if (block.type === "chat") {
    openChatDialog(block);
  } else {
    alert("Edit for images not implemented yet.");
  }

  closeBlockMenu();
});

blockMenuDelete.addEventListener("click", async () => {
  if (!currentMenuBlockId) return;
  const idToDelete = currentMenuBlockId;
  closeBlockMenu();

  try {
    await deleteBlockOnBackend(idToDelete);
    blocks = blocks.filter(b => b.id !== idToDelete);
    renderBlocks();
  } catch (err) {
    console.error(err);
    alert("Failed to delete block: " + err.message);
  }
});

// Close block menu if clicking outside
document.addEventListener("click", (e) => {
  if (!blockMenu.classList.contains("hidden")) {
    if (!blockMenu.contains(e.target)) {
      closeBlockMenu();
    }
  }
});

// ----------------------
// Text dialog
// ----------------------

function openTextDialog(blockOrNull) {
  currentEditingBlockId = blockOrNull ? blockOrNull.id : null;
  textDialogTitle.textContent = blockOrNull ? "Edit Text" : "Add Text";
  textDialogInput.value = blockOrNull ? (blockOrNull.content || "") : "";
  textDialog.classList.remove("hidden");
}

function closeTextDialog() {
  textDialog.classList.add("hidden");
  textDialogInput.value = "";
  currentEditingBlockId = null;
}

textDialogCancel.addEventListener("click", closeTextDialog);

textDialogSave.addEventListener("click", async () => {
  const text = textDialogInput.value.trim();
  if (!text) {
    closeTextDialog();
    return;
  }

  try {
    if (currentEditingBlockId) {
      // update backend
      const updated = await updateBlockOnBackend(currentEditingBlockId, {
        content: text
      });
      // update local
      const idx = blocks.findIndex(b => b.id === currentEditingBlockId);
      if (idx !== -1) blocks[idx] = updated;
    } else {
      // create new
      const created = await createBlockOnBackend({
        type: "text",
        content: text,
        characterId: null,
        imageUrl: null
      });
      blocks.push(created);
    }

    renderBlocks();
    closeTextDialog();
  } catch (err) {
    console.error(err);
    alert("Failed to save text block: " + err.message);
  }
});

// ----------------------
// Chat dialog
// ----------------------

function openChatDialog(blockOrNull) {
  currentEditingBlockId = blockOrNull ? blockOrNull.id : null;
  chatMessageInput.value = blockOrNull ? (blockOrNull.content || "") : "";

  chatCharacterSelect.innerHTML = "";
  characters.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    chatCharacterSelect.appendChild(opt);
  });

  if (blockOrNull && blockOrNull.characterId) {
    chatCharacterSelect.value = blockOrNull.characterId;
  }

  chatDialog.classList.remove("hidden");
}

function closeChatDialog() {
  chatDialog.classList.add("hidden");
  chatMessageInput.value = "";
  currentEditingBlockId = null;
}

chatDialogCancel.addEventListener("click", closeChatDialog);

chatDialogSave.addEventListener("click", async () => {
  const message = chatMessageInput.value.trim();
  const charId = chatCharacterSelect.value;
  if (!message || !charId) {
    closeChatDialog();
    return;
  }

  try {
    if (currentEditingBlockId) {
      const updated = await updateBlockOnBackend(currentEditingBlockId, {
        content: message,
        characterId: charId
      });
      const idx = blocks.findIndex(b => b.id === currentEditingBlockId);
      if (idx !== -1) blocks[idx] = updated;
    } else {
      const created = await createBlockOnBackend({
        type: "chat",
        content: message,
        characterId: charId,
        imageUrl: null
      });
      blocks.push(created);
    }

    renderBlocks();
    closeChatDialog();
  } catch (err) {
    console.error(err);
    alert("Failed to save chat block: " + err.message);
  }
});

// ----------------------
// Characters dialog
// ----------------------

function openCharactersDialog() {
  renderCharactersList();
  charactersDialog.classList.remove("hidden");
}

function closeCharactersDialog() {
  charactersDialog.classList.add("hidden");
}

charactersDialogClose.addEventListener("click", closeCharactersDialog);

function renderCharactersList() {
  charactersList.innerHTML = "";
  characters.forEach(c => {
    const chip = document.createElement("div");
    chip.className = "character-chip";

    const circle = document.createElement("div");
    circle.className = "avatar-circle";
    circle.style.backgroundColor = c.color;
    circle.textContent = c.name.charAt(0).toUpperCase();
    chip.appendChild(circle);

    const name = document.createElement("h6");
    name.textContent = c.name;
    chip.appendChild(name);

    charactersList.appendChild(chip);
  });
}

addCharacterButton.addEventListener("click", () => {
  const name = newCharacterName.value.trim();
  if (!name) return;
  characters.push({
    id: "c" + Date.now(),
    name,
    color: "#a876ff"
  });
  newCharacterName.value = "";
  renderCharactersList();
});

// ----------------------
// Toolbar actions
// ----------------------

toolbarButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    if (action === "text") {
      openTextDialog(null);
    } else if (action === "chat") {
      if (characters.length === 0) {
        alert("Add a character first.");
        openCharactersDialog();
      } else {
        openChatDialog(null);
      }
    } else if (action === "characters") {
      openCharactersDialog();
    } else if (action === "image") {
      imageInput.click();
    }
  });
});

// Image picker -> create image block in backend
imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];
  if (!file) return;

  // For now we don't upload to backend yet; just show preview and save URL placeholder.
  // Later we can add real upload endpoint.
  const reader = new FileReader();
  reader.onload = async (e) => {
    const url = e.target.result;

    try {
      const created = await createBlockOnBackend({
        type: "image",
        content: null,
        characterId: null,
        imageUrl: url   // data URL just for dev; later replace with real URL
      });
      blocks.push(created);
      renderBlocks();
    } catch (err) {
      console.error(err);
      alert("Failed to save image block: " + err.message);
    }
  };
  reader.readAsDataURL(file);
  imageInput.value = "";
});

// ----------------------
// Menu (Save / Publish / Manage)
// ----------------------

if (menuButton && menuDropdown) {
  function toggleMenuDropdown() {
    if (menuDropdown.classList.contains("hidden")) {
      menuDropdown.classList.remove("hidden");
    } else {
      menuDropdown.classList.add("hidden");
    }
  }

  menuButton.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenuDropdown();
  });

  document.addEventListener("click", (e) => {
    if (!menuDropdown.classList.contains("hidden")) {
      if (!menuDropdown.contains(e.target) && e.target !== menuButton) {
        menuDropdown.classList.add("hidden");
      }
    }
  });

  menuSave.addEventListener("click", () => {
    menuDropdown.classList.add("hidden");
    // At this stage, every block change is already sent to backend,
    // so Save can simply confirm.
    alert("Saved! Blocks are already stored in backend.");
  });

  menuPublish.addEventListener("click", async () => {
    menuDropdown.classList.add("hidden");
    if (!storyId) {
      alert("No storyId. Save story details first.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/stories/${encodeURIComponent(storyId)}/publish`, {
        method: "POST"
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to publish");
      }
      alert("Story published!");
    } catch (err) {
      console.error(err);
      alert("Failed to publish: " + err.message);
    }
  });

  menuManage.addEventListener("click", () => {
    menuDropdown.classList.add("hidden");
    alert("Manage is for later (reordering blocks, etc).");
  });
}

// ----------------------
// Init
// ----------------------

fetchBlocksFromBackend();
