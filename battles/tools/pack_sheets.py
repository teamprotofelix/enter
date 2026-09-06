# Pack per-character pose stills into 4x2 sprite sheets (256px cells, no dividers).
from PIL import Image
from collections import deque
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
POSE = os.path.join(ROOT, "사용하지 않는 이미지", "poses")
SPR = os.path.join(ROOT, "assets", "sprites")
CELL = 192
COLS, ROWS = 4, 4
ORDER = [
    "idle", "move", "punch", "kick",
    "punch_up", "kick_up", "punch_down", "kick_down",
    "punch_side", "kick_side", "special", "hurt",
    "fly", "win", "ko", "special2",
]
CHARS = [
    ("dana", "boss_dana"),
    ("right", "boss_right"),
    ("park", "boss_park"),
    ("bang", "boss_bang"),
    ("namsa", "boss_namsa"),
    ("golf", "boss_golf"),
    ("beer", "boss_beer"),
    ("jina", "boss_jina"),
    ("woo", "boss_woo"),
    ("villain", "boss_villain"),
    ("gucci", "boss_gucci"),
    ("buddy", "boss_buddy"),
    ("gira", "boss_gira"),
    ("takgu", "boss_takgu"),
    ("coffee", "boss_coffee"),
]


def key_black(im):
    im = im.convert("RGBA")
    # shrink first so flood-fill is cheap
    if max(im.size) > 420:
        s = 420 / max(im.size)
        im = im.resize((max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s))), Image.BILINEAR)
    w, h = im.size
    pix = im.load()

    def dark(p):
        r, g, b, a = p
        return a > 0 and r < 22 and g < 22 and b < 22

    vis = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or vis[x][y]:
            continue
        vis[x][y] = True
        if pix[x, y][3] == 0:
            q.append((x + 1, y))
            q.append((x - 1, y))
            q.append((x, y + 1))
            q.append((x, y - 1))
            continue
        if not dark(pix[x, y]):
            continue
        pix[x, y] = (0, 0, 0, 0)
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))
    return im


def fit_cell(im):
    if im is None:
        return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    bbox = im.getbbox()
    if not bbox:
        return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cropped = im.crop(bbox)
    w, h = cropped.size
    max_side = int(CELL * 0.9)
    scale = min(max_side / w, max_side / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    cropped = cropped.resize((nw, nh), Image.LANCZOS)
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.paste(cropped, ((CELL - nw) // 2, (CELL - nh) // 2), cropped)
    return cell


def load_any(path_no_ext):
    for ext in (".png", ".jpg", ".jpeg"):
        p = path_no_ext + ext
        if os.path.exists(p):
            im = Image.open(p)
            if im.mode != "RGBA":
                return key_black(im)
            # already png: still key near-black edges if needed
            return key_black(im)
    return None


def pose_img(key, pose, idle):
    im = load_any(os.path.join(POSE, key + "_" + pose))
    if im is not None:
        return im
    chain = {
        "move": ["idle"],
        "kick": ["punch"],
        "punch_up": ["punch"],
        "kick_up": ["fly", "kick"],
        "punch_down": ["punch"],
        "kick_down": ["kick", "punch"],
        "punch_side": ["punch"],
        "kick_side": ["kick", "punch"],
        "special": ["punch"],
        "special2": ["special", "punch"],
        "hurt": ["idle"],
        "ko": ["hurt", "idle"],
        "win": ["idle"],
        "fly": ["punch_up", "idle"],
    }.get(pose, [])
    if pose == "idle" or pose == "punch":
        return idle
    for fb in chain:
        alt = load_any(os.path.join(POSE, key + "_" + fb))
        if alt is not None:
            return alt
        if fb == "idle":
            return idle
    return idle


def pack_one(key, art):
    idle = load_any(os.path.join(SPR, art))
    if idle is None:
        print("missing idle", art)
        return
    sheet = Image.new("RGBA", (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
    used = []
    for i, pose in enumerate(ORDER):
        src = pose_img(key, pose, idle)
        cell = fit_cell(src)
        cx, cy = (i % COLS) * CELL, (i // COLS) * CELL
        sheet.paste(cell, (cx, cy), cell)
        has = load_any(os.path.join(POSE, key + "_" + pose)) is not None or pose == "idle"
        used.append(pose if has else pose + "*")
    out = os.path.join(SPR, "sheet_" + key + ".png")
    sheet.save(out, optimize=True)
    print("wrote", os.path.basename(out), " ".join(used))


def main():
    os.makedirs(POSE, exist_ok=True)
    for key, art in CHARS:
        pack_one(key, art)


if __name__ == "__main__":
    main()
