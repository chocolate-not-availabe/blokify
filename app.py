from flask import Flask, request, jsonify
from datetime import datetime
from uuid import uuid4
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# -----------------------------
# In-memory "database"
# -----------------------------

users = {}              # userId -> user dict
stories = {}            # storyId -> story dict
blocks = {}             # storyId -> list of blocks
reading_progress = {}   # (userId, storyId) -> last index
user_taps = {}          # (userId, storyId) -> total taps for that reader/story


def now_ts():
    return int(datetime.utcnow().timestamp())


def make_story_id():
    return "s_" + uuid4().hex[:8]


def make_block_id():
    return "b_" + uuid4().hex[:8]


def make_user_id():
    return "u_" + uuid4().hex[:8]


def public_user(user):
    """Return user data without password."""
    if not user:
        return None
    return {
        "id": user["id"],
        "email": user["email"],
        "username": user.get("username", ""),
        "bio": user.get("bio", ""),
        "avatarUrl": user.get("avatarUrl", ""),
        "createdAt": user.get("createdAt", 0),
    }


# -----------------------------
# Basic root
# -----------------------------

@app.route("/")
def index():
    return jsonify({"message": "Blokify backend is running"})


# -----------------------------
# Auth: signup / login
# -----------------------------

@app.route("/auth/signup", methods=["POST"])
def signup():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    username = (data.get("username") or "").strip()

    if not email or not password or not username:
        return jsonify({"error": "email, password and username are required"}), 400

    # check if email already used
    for u in users.values():
        if u["email"] == email:
            return jsonify({"error": "Email already in use"}), 400

    user_id = make_user_id()
    timestamp = now_ts()
    user = {
        "id": user_id,
        "email": email,
        "password": password,  # NOTE: plain text for demo only!
        "username": username,
        "bio": "",
        "avatarUrl": "",
        "createdAt": timestamp,
    }
    users[user_id] = user

    return jsonify(public_user(user)), 201


@app.route("/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    for user in users.values():
        if user["email"] == email and user["password"] == password:
            return jsonify(public_user(user))

    return jsonify({"error": "Invalid email or password"}), 401


# -----------------------------
# User profile
# -----------------------------

@app.route("/users/<user_id>", methods=["GET"])
def get_user(user_id):
    user = users.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    # stories this user wrote
    authored = [s for s in stories.values() if s.get("authorId") == user_id]
    total_stories = len(authored)
    published_stories = sum(1 for s in authored if s.get("status") == "published")
    drafts = total_stories - published_stories

    # how many stories this user is currently reading
    reading_count = 0
    for (u, story_id), idx in reading_progress.items():
        if u == user_id and story_id in stories:
            reading_count += 1

    # total taps on all this author's stories (from all readers)
    tap_count_on_my_stories = 0
    for (reader_id, story_id), taps in user_taps.items():
        story = stories.get(story_id)
        if story and story.get("authorId") == user_id:
            tap_count_on_my_stories += taps

    result = public_user(user)
    result.update({
        "totalStories": total_stories,
        "publishedStories": published_stories,
        "draftStories": drafts,
        "readingCount": reading_count,
        "tapCount": tap_count_on_my_stories,
    })
    return jsonify(result)


@app.route("/users/<user_id>", methods=["PUT"])
def update_user(user_id):
    user = users.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.json or {}
    username = data.get("username")
    bio = data.get("bio")
    avatarUrl = data.get("avatarUrl")

    if username is not None:
        user["username"] = username.strip()
    if bio is not None:
        user["bio"] = bio
    if avatarUrl is not None:
        user["avatarUrl"] = avatarUrl

    return jsonify(public_user(user))


# -----------------------------
# Stories (home / details)
# -----------------------------

@app.route("/stories/your", methods=["GET"])
def get_your_stories():
    user_id = request.args.get("userId")
    if not user_id:
        return jsonify({"error": "userId is required"}), 400

    result = [
        s for s in stories.values()
        if s.get("authorId") == user_id and s.get("status") == "published"
    ]
    result.sort(key=lambda s: s.get("updatedAt", 0), reverse=True)
    return jsonify(result)


@app.route("/stories/newbies", methods=["GET"])
def get_newbies():
    result = [s for s in stories.values() if s.get("status") == "published"]
    result.sort(key=lambda s: s.get("createdAt", 0), reverse=True)
    limit = int(request.args.get("limit", 20))
    return jsonify(result[:limit])


@app.route("/stories/reading", methods=["GET"])
def get_reading():
    user_id = request.args.get("userId")
    if not user_id:
        return jsonify({"error": "userId is required"}), 400

    result = []
    for (u, story_id), last_idx in reading_progress.items():
        if u == user_id and story_id in stories:
            result.append(stories[story_id])

    result.sort(key=lambda s: s.get("updatedAt", 0), reverse=True)
    return jsonify(result)


@app.route("/stories/<story_id>", methods=["GET"])
def get_story(story_id):
    story = stories.get(story_id)
    if not story:
        return jsonify({"error": "Story not found"}), 404
    return jsonify(story)


@app.route("/stories", methods=["POST"])
def create_or_update_story():
    data = request.json or {}
    story_id = data.get("id")  # if provided, update; else create new
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    genre = (data.get("genre") or "").strip()
    tags = data.get("tags", [])
    original = bool(data.get("original", True))
    author_id = data.get("authorId") or "user123"
    cover_url = data.get("coverUrl", "")

    if not title:
        return jsonify({"error": "Title is required"}), 400

    timestamp = now_ts()

    if story_id and story_id in stories:
        # update existing
        story = stories[story_id]
        story.update({
            "title": title,
            "description": description,
            "genre": genre,
            "tags": tags,
            "original": original,
            "coverUrl": cover_url or story.get("coverUrl", ""),
            "updatedAt": timestamp
        })
    else:
        # create new
        story_id = make_story_id()
        story = {
            "id": story_id,
            "authorId": author_id,
            "title": title,
            "description": description,
            "genre": genre,
            "tags": tags,
            "original": original,
            "coverUrl": cover_url,
            "status": "draft",
            "createdAt": timestamp,
            "updatedAt": timestamp
        }
        stories[story_id] = story
        blocks[story_id] = []

    return jsonify(story)


@app.route("/stories/<story_id>/publish", methods=["POST"])
def publish_story(story_id):
    story = stories.get(story_id)
    if not story:
        return jsonify({"error": "Story not found"}), 404

    story["status"] = "published"
    story["updatedAt"] = now_ts()
    return jsonify(story)


# -----------------------------
# Blocks (writing / reading)
# -----------------------------

@app.route("/stories/<story_id>/blocks", methods=["GET"])
def get_blocks(story_id):
    story_blocks = blocks.get(story_id)
    if story_blocks is None:
        return jsonify({"error": "Story not found"}), 404

    return jsonify(story_blocks)


@app.route("/stories/<story_id>/blocks", methods=["POST"])
def add_block(story_id):
    if story_id not in stories:
        return jsonify({"error": "Story not found"}), 404

    data = request.json or {}
    block_type = data.get("type")
    content = data.get("content")
    character_id = data.get("characterId")
    image_url = data.get("imageUrl")

    if block_type not in ("text", "chat", "image"):
        return jsonify({"error": "Invalid block type"}), 400

    story_blocks = blocks.setdefault(story_id, [])
    new_block = {
        "id": make_block_id(),
        "storyId": story_id,
        "type": block_type,
        "content": content,
        "characterId": character_id,
        "imageUrl": image_url,
        "index": len(story_blocks)
    }
    story_blocks.append(new_block)
    stories[story_id]["updatedAt"] = now_ts()
    return jsonify(new_block), 201


@app.route("/blocks/<block_id>", methods=["PUT"])
def edit_block(block_id):
    for story_id, story_blocks in blocks.items():
        for b in story_blocks:
            if b["id"] == block_id:
                data = request.json or {}
                if b["type"] in ("text", "chat"):
                    if "content" in data:
                        b["content"] = data["content"]
                    if b["type"] == "chat" and "characterId" in data:
                        b["characterId"] = data["characterId"]
                    stories[story_id]["updatedAt"] = now_ts()
                    return jsonify(b)
                else:
                    return jsonify({"error": "Editing images not implemented"}), 400

    return jsonify({"error": "Block not found"}), 404


@app.route("/blocks/<block_id>", methods=["DELETE"])
def delete_block(block_id):
    for story_id, story_blocks in blocks.items():
        for i, b in enumerate(story_blocks):
            if b["id"] == block_id:
                story_blocks.pop(i)
                # reindex
                for idx, block in enumerate(story_blocks):
                    block["index"] = idx
                stories[story_id]["updatedAt"] = now_ts()
                return jsonify({"success": True})

    return jsonify({"error": "Block not found"}), 404


# -----------------------------
# Reading progress & taps
# -----------------------------

@app.route("/progress", methods=["POST"])
def save_progress():
    data = request.json or {}
    user_id = data.get("userId")
    story_id = data.get("storyId")
    last_index = data.get("lastBlockIndex")

    if not user_id or not story_id:
        return jsonify({"error": "userId and storyId required"}), 400

    key = (user_id, story_id)

    # Save where the reader reached
    reading_progress[key] = last_index

    # Count this tap (one tap = one step to next block)
    current_taps = user_taps.get(key, 0) + 1
    user_taps[key] = current_taps

    return jsonify({"success": True, "tapCountForThisReader": current_taps})


@app.route("/progress/<story_id>", methods=["GET"])
def get_progress(story_id):
    user_id = request.args.get("userId")
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    key = (user_id, story_id)
    last_index = reading_progress.get(key, -1)
    return jsonify({"lastBlockIndex": last_index})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
