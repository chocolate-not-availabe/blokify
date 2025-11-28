// profile.js

const API_BASE = "https://blokify.onrender.com";

const avatarEl = document.getElementById("profileAvatar");
const usernameEl = document.getElementById("profileUsername");
const emailEl = document.getElementById("profileEmail");

const statWorks = document.getElementById("statWorks");
const statTaps = document.getElementById("statTaps");
const statReading = document.getElementById("statReading");

const bioInput = document.getElementById("bioInput");
const saveProfileButton = document.getElementById("saveProfileButton");
const logoutButton = document.getElementById("logoutButton");

// Settings controls
const readingTextSizeSelect = document.getElementById("readingTextSizeSelect");

// Get user from localStorage
const raw = localStorage.getItem("blokifyUser");
if (!raw) {
  // not logged in
  window.location.href = "auth.html";
}

const currentUser = raw ? JSON.parse(raw) : null;
const USER_ID = currentUser?.id;

// Key for storing settings per user
function settingsKey() {
  return `blokifySettings_${USER_ID}`;
}

// Load settings from localStorage
function loadSettings() {
  const rawSettings = localStorage.getItem(settingsKey());
  if (!rawSettings) {
    // defaults
    readingTextSizeSelect.value = "normal";
    return;
  }

  try {
    const settings = JSON.parse(rawSettings);
    readingTextSizeSelect.value = settings.readingTextSize || "normal";
  } catch (e) {
    console.error("Failed to parse settings:", e);
    readingTextSizeSelect.value = "normal";
  }
}

// Save settings to localStorage
function saveSettings() {
  const settings = {
    readingTextSize: readingTextSizeSelect.value || "normal",
  };
  localStorage.setItem(settingsKey(), JSON.stringify(settings));
}

// Load profile from backend
async function loadProfile() {
  if (!USER_ID) return;

  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(USER_ID)}`);
    if (!res.ok) {
      console.error("Failed to load profile:", res.status);
      return;
    }

    const data = await res.json();

    const username = data.username || "Unknown";
    const email = data.email || "";
    const bio = data.bio || "";

    avatarEl.textContent = username.charAt(0).toUpperCase();
    usernameEl.textContent = username;
    emailEl.textContent = email;
    bioInput.value = bio;

    statWorks.textContent = data.totalStories ?? 0;
    statTaps.textContent = data.tapCount ?? 0;
    statReading.textContent = data.readingCount ?? 0;

    // after profile data, load settings
    loadSettings();

  } catch (err) {
    console.error(err);
  }
}

loadProfile();

// Save profile + settings
saveProfileButton.addEventListener("click", async () => {
  const newUsername = usernameEl.textContent.trim(); // still static text for now
  const newBio = bioInput.value;

  // Save settings locally
  saveSettings();

  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(USER_ID)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUsername,
        bio: newBio
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to save profile");
      return;
    }

    // Update localStorage user too
    const rawUser = localStorage.getItem("blokifyUser");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      u.username = data.username;
      u.bio = data.bio;
      localStorage.setItem("blokifyUser", JSON.stringify(u));
    }

    alert("Profile & settings saved.");
  } catch (err) {
    console.error(err);
    alert("Could not save profile.");
  }
});

// Logout
logoutButton.addEventListener("click", () => {
  localStorage.removeItem("blokifyUser");
  window.location.href = "auth.html";
});
