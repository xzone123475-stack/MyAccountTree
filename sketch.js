// 스케치: 링 모음의 원형 배열과 플래시 모션을 가진 애니메이션
let rings = [];
let input;
let baseRadius;

const RESET_CODE = "1125";
const MAX_RINGS = 7;
const MAX_FONT = 56;

const DESKTOP_INITIAL_ZOOM = 2;
const DESKTOP_MIN_ZOOM = 1.3;

const MOBILE_INITIAL_ZOOM = 1;
const MOBILE_MIN_ZOOM = 0.5;

const MOBILE_BREAKPOINT = 768;

let INITIAL_ZOOM = DESKTOP_INITIAL_ZOOM;
let FIXED_MIN_ZOOM = DESKTOP_MIN_ZOOM;

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

let lastTouchDist = null;
let lastTapTime = 0;

let fonts = [];
let fontsReady = false;

let isComposing = false;

let flash = null;
const FLASH_EXPAND = 80;
const FLASH_HOLD = 60;
const FLASH_SHRINK = 180;

function getRingGap(ring) {
  const scaledFont = Number(ring.fontSize ?? 20) * (min(windowWidth, windowHeight) / 800);
  return scaledFont + 4;
}

function preload() {
  fonts = [
    loadFont("fonts/BagelFatOne-Regular.ttf"),
    loadFont("fonts/Dongle-Regular.ttf"),
    loadFont("fonts/GrandifloraOne-Regular.ttf"),
    loadFont("fonts/MoiraiOne-Regular.ttf"),
    loadFont("fonts/Orbit-Regular.ttf"),
    loadFont("fonts/Sunflower-Medium.ttf"),
  ];
}

function getDB() {
  try { if (typeof db !== "undefined" && db) return db; } catch (e) {}
  if (typeof window !== "undefined" && window.db) return window.db;
  if (typeof firebase !== "undefined" && firebase.database) {
    try { return firebase.database(); } catch (e) {}
  }
  return null;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  updateLayout();

  zoom = INITIAL_ZOOM;
  offsetX = 0;
  offsetY = 0;

  input = document.getElementById("mainInput");
  fontsReady = fonts.length > 0;

  input.addEventListener("compositionstart", () => { isComposing = true; });
  input.addEventListener("compositionend", () => { isComposing = false; });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isComposing) return;
      handleInput(input.value.trim());
    }
  });

  const database = getDB();
  if (database) {
    database.ref("rings").on("value", (snapshot) => {
      const data = snapshot.val();
      const next = [];
      if (data) {
        Object.keys(data).forEach((k) => {
          const idx = Number(k);
          if (Number.isInteger(idx) && idx >= 0 && idx < MAX_RINGS) {
            next[idx] = data[k];
          }
        });
      }
      for (let i = 0; i < MAX_RINGS; i++) {
        if (next[i] === undefined) next[i] = null;
      }
      while (next.length > 0 && next[next.length - 1] == null) next.pop();
      rings = next;
    }, (err) => {
      console.error("Firebase read failed:", err);
    });
  } else {
    console.warn("Firebase not initialized — running in local-only mode.");
  }
}

function estimateNextRingRadius() {
  let r = baseRadius;
  for (let i = 0; i < rings.length; i++) {
    if (rings[i]) r += getRingGap(rings[i]);
  }
  return r * zoom;
}

function triggerFlash(r, g, b) {
  const startR = estimateNextRingRadius();
  const cx = width / 2 + offsetX;
  const cy = height / 2 + offsetY;
  const corners = [
    dist(cx, cy, 0, 0),
    dist(cx, cy, width, 0),
    dist(cx, cy, 0, height),
    dist(cx, cy, width, height),
  ];
  const maxR = max(corners) + 40;

  flash = {
    r: Number(r ?? 160),
    g: Number(g ?? 160),
    b: Number(b ?? 160),
    cx: cx,
    cy: cy,
    startR: startR,
    maxR: maxR,
    start: millis(),
  };
}

function handleInput(val) {
  if (!val) return;

  const database = getDB();

  if (val === RESET_CODE) {
    if (database) {
      database.ref("rings").remove();
      database.ref("meta/writeCount").set(0);
    } else {
      rings = [];
    }
    input.value = "";
    return;
  }

  const r = floor(random(80, 220));
  const g = floor(random(80, 220));
  const b = floor(random(80, 220));

  triggerFlash(r, g, b);

  if (database) {
    database.ref("meta/writeCount").transaction(
      (cur) => (Number(cur) || 0) + 1,
      (err, committed, snap) => {
        if (err || !committed || !snap) return;
        const count = Number(snap.val()) || 1;
        const slotIndex = (count - 1) % MAX_RINGS;
        const ringData = createRing(val, slotIndex, r, g, b);
        database.ref("rings/" + slotIndex).set(ringData);
      }
    );
  } else {
    const nextSlot = rings.findIndex(x => x == null);
    const slotIndex = (nextSlot >= 0 && nextSlot < MAX_RINGS)
      ? nextSlot
      : (rings.length % MAX_RINGS);
    rings[slotIndex] = createRing(val, slotIndex, r, g, b);
  }

  input.value = "";
}

function draw() {
  background(255);

  push();
  translate(width / 2 + offsetX, height / 2 + offsetY);
  scale(zoom);

  let currentRadius = baseRadius;

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (!ring) continue;

    push();

    let sp = Number(ring.speed) || 0.3;
    if (abs(sp) < 0.075) sp = 0.3;

    rotate(millis() * 0.02 * sp + Number(ring.angleOffset || 0));

    const fontIndex = Number.isInteger(ring.fontIndex)
      ? ring.fontIndex
      : parseInt(ring.fontIndex, 10);

    if (fontsReady && fonts[fontIndex]) {
      textFont(fonts[fontIndex]);
    }

    fill(Number(ring.r ?? 160),
         Number(ring.g ?? 160),
         Number(ring.b ?? 160),
         255);
    noStroke();

    textSize(Number(ring.fontSize ?? 20) * (min(width, height) / 800));

    drawTextCircle(ring, currentRadius);
    pop();

    currentRadius += getRingGap(ring);
  }
  pop();

  drawFlash();
}

function easeOutBack(t) {
  const s = 2.2;
  const u = t - 1;
  return u * u * ((s + 1) * u + s) + 1;
}
function easeInBack(t) {
  const s = 2.2;
  return t * t * ((s + 1) * t - s);
}

function drawFlash() {
  if (!flash) return;

  const elapsed = millis() - flash.start;
  const total = FLASH_EXPAND + FLASH_HOLD + FLASH_SHRINK;

  if (elapsed >= total) {
    flash = null;
    return;
  }

  let radius;
  if (elapsed < FLASH_EXPAND) {
    const t = elapsed / FLASH_EXPAND;
    radius = lerp(flash.startR, flash.maxR, easeOutBack(t));
  } else if (elapsed < FLASH_EXPAND + FLASH_HOLD) {
    radius = flash.maxR;
  } else {
    const t = (elapsed - FLASH_EXPAND - FLASH_HOLD) / FLASH_SHRINK;
    radius = lerp(flash.maxR, 0, easeInBack(t));
  }

  if (radius <= 0) return;

  push();
  resetMatrix();
  noStroke();
  ellipseMode(CENTER);
  fill(flash.r, flash.g, flash.b);
  ellipse(flash.cx, flash.cy, radius * 2, radius * 2);
  pop();
}

function createRing(text, slotIndex, r, g, b) {
  let sp = random(-0.9, 0.9);
  if (random() < 0.5) {
    sp *= 0.9;
  }
  if (abs(sp) < 0.225) {
    sp = sp < 0 ? -0.225 : 0.225;
  }

  return {
    text: text,
    slotIndex: slotIndex,
    fontIndex: floor(random(fonts.length)),
    r: r,
    g: g,
    b: b,
    speed: sp,
    angleOffset: random(360),
    fontSize: random(20, MAX_FONT),
    spacingFactor: random(0.72, 1.45),
    wobble: random(-8, 8),
  };
}

function drawTextCircle(ring, r) {
  const str = String(ring.text ?? "");
  let angle = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const charWidth = textWidth(char);
    const minSpacing = 3;

    const angleStep =
      ((charWidth + minSpacing) / (2 * PI * r)) *
      360 *
      Number(ring.spacingFactor ?? 1);

    const x = cos(angle) * r;
    const y = sin(angle) * r;

    push();
    translate(x, y);
    rotate(angle + 90 + Number(ring.wobble ?? 0));
    textAlign(CENTER, CENTER);
    text(char, 0, 0);
    pop();

    angle += angleStep;
  }
}

function getMinZoom() {
  return FIXED_MIN_ZOOM;
}

function applyZoomCenter(newZoom) {
  const minZoom = getMinZoom();
  zoom = constrain(newZoom, minZoom, 6);
  clampOffsets(false);
}

function updateLayout() {
  const base = min(windowWidth, windowHeight);
  baseRadius = base * 0.12;

  const isMobile = windowWidth < MOBILE_BREAKPOINT;
  INITIAL_ZOOM   = isMobile ? MOBILE_INITIAL_ZOOM : DESKTOP_INITIAL_ZOOM;
  FIXED_MIN_ZOOM = isMobile ? MOBILE_MIN_ZOOM     : DESKTOP_MIN_ZOOM;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();
  clampOffsets(true);
}

function getOuterRadius() {
  if (rings.length <= 0) return baseRadius;

  let currentRadius = baseRadius;
  for (let i = 0; i < rings.length; i++) {
    if (rings[i]) currentRadius += getRingGap(rings[i]);
  }

  return currentRadius + 60;
}

function getMaxOffset() {
  const outerRadius = getOuterRadius() * zoom;
  const maxX = max(0, outerRadius - width * 0.18);
  const maxY = max(0, outerRadius - height * 0.18);
  return { x: maxX, y: maxY };
}

function clampOffsets(instant = false) {
  const limit = getMaxOffset();
  const minZ = getMinZoom();
  const pullToCenter = map(zoom, minZ, minZ * 1.15, 0.9, 0.0, true);

  let targetX = constrain(offsetX, -limit.x, limit.x);
  let targetY = constrain(offsetY, -limit.y, limit.y);
  targetX *= (1 - pullToCenter);
  targetY *= (1 - pullToCenter);

  if (instant) {
    offsetX = targetX;
    offsetY = targetY;
  } else {
    offsetX = lerp(offsetX, targetX, 0.25);
    offsetY = lerp(offsetY, targetY, 0.25);
  }
}

function touchMoved() {
  if (touches.length === 2) {
    const x1 = touches[0].x;
    const y1 = touches[0].y;
    const x2 = touches[1].x;
    const y2 = touches[1].y;

    const d = dist(x1, y1, x2, y2);

    if (lastTouchDist !== null) {
      let newZoom = zoom * (d / lastTouchDist);
      applyZoomCenter(newZoom);
    }

    lastTouchDist = d;
  } else if (touches.length === 1) {
    offsetX += movedX;
    offsetY += movedY;
    clampOffsets(false);
  }

  return false;
}

function touchStarted() {
  const now = millis();
  if (now - lastTapTime < 300) {
    resetView();
  }
  lastTapTime = now;
}

function touchEnded() {
  if (touches.length < 2) {
    lastTouchDist = null;
  }
}

function resetView() {
  zoom = INITIAL_ZOOM;
  offsetX = 0;
  offsetY = 0;
}

function mouseWheel(event) {
  let newZoom = zoom - event.delta * 0.001;
  applyZoomCenter(newZoom);
  return false;
}
