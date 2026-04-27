let rings = [];
let input;
let baseRadius;

const RESET_CODE = "1125";
const MAX_RINGS = 7;
const MAX_FONT = 56;

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

let lastTouchDist = null;
let lastTapTime = 0;

let fonts = [];
let fontsReady = false;

let isComposing = false;

// ──────────────────────────────────────────
// 링 간격: fontSize 기반으로 딱 붙게
// ──────────────────────────────────────────
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

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  updateLayout();

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

  // Firebase: 슬롯 기반(slot0~slot6) 구조로 읽기
  db.ref("rings").on("value", (snapshot) => {
    const data = snapshot.val();
    rings = new Array(MAX_RINGS).fill(null);

    if (data) {
      Object.values(data).forEach((item) => {
        const idx = Number(item.slotIndex ?? 0);
        if (idx >= 0 && idx < MAX_RINGS) {
          rings[idx] = item;
        }
      });
    }

    rings = rings.filter((r) => r !== null);
    clampOffsets(true);
  });
}

// ──────────────────────────────────────────
// handleInput: 트랜잭션으로 race condition 방지
// ──────────────────────────────────────────
function handleInput(val) {
  if (!val) return;

  if (val === RESET_CODE) {
    db.ref("rings").remove();
    db.ref("meta").remove();
  } else {
    db.ref("meta/nextSlot").transaction((currentSlot) => {
      const slot = (currentSlot ?? 0) % MAX_RINGS;
      return (slot + 1) % MAX_RINGS;
    }).then((result) => {
      if (!result.committed) return;

      const nextSlot = result.snapshot.val();
      const slotIndex = (nextSlot - 1 + MAX_RINGS) % MAX_RINGS;

      const ringData = createRing(val, slotIndex);
      db.ref("rings/slot" + slotIndex).set(ringData);
    });
  }

  input.value = "";
}

function draw() {
  background(255);

  translate(width / 2 + offsetX, height / 2 + offsetY);
  scale(zoom);

  let currentRadius = baseRadius;

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (!ring) continue;

    push();

    let sp = Number(ring.speed);
    if (!sp || abs(sp) < 0.05) sp = 0.2;

    rotate(millis() * 0.02 * sp + Number(ring.angleOffset || 0));

    const fontIndex = Number.isInteger(ring.fontIndex)
      ? ring.fontIndex
      : parseInt(ring.fontIndex, 10);

    if (fontsReady && fonts[fontIndex]) {
      textFont(fonts[fontIndex]);
    }

    fill(
      Number(ring.r ?? 160),
      Number(ring.g ?? 160),
      Number(ring.b ?? 160)
    );
    noStroke();

    textSize(Number(ring.fontSize ?? 20) * (min(width, height) / 800));

    drawTextCircle(ring, currentRadius);
    pop();

    currentRadius += getRingGap(ring);
  }
}

function createRing(text, slotIndex) {
  let sp = random(-0.6, 0.6);
  if (abs(sp) < 0.15) {
    sp = sp < 0 ? -0.15 : 0.15;
  }

  const r = floor(random(80, 220));
  const g = floor(random(80, 220));
  const b = floor(random(80, 220));

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

// ──────────────────────────────────────────
// 최소 줌: 7링 × 최대 폰트(56) 기준 — 항상 7링 다 들어옴
// ──────────────────────────────────────────
function getMinZoom() {
  const scale = min(windowWidth, windowHeight) / 800;
  const worstGap = MAX_FONT * scale + 4;
  const worstOuterR = baseRadius + (MAX_RINGS * worstGap) + 60;

  const fitZoom = (min(width, height) * 0.48) / worstOuterR;
  return max(0.05, fitZoom);
}

// ──────────────────────────────────────────
// 줌: 순수 중앙 기준 (트랙패드 휠 / 핀치 공통)
// offset 건드리지 않음
// ──────────────────────────────────────────
function applyZoomCenter(newZoom) {
  const minZoom = getMinZoom();
  zoom = constrain(newZoom, minZoom, 6);
  clampOffsets(false);
}

function updateLayout() {
  const base = min(windowWidth, windowHeight);
  baseRadius = base * 0.12;
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
  const maxX = max(0, outerRadius - width * 0.22);
  const maxY = max(0, outerRadius - height * 0.22);
  return { x: maxX, y: maxY };
}

// ──────────────────────────────────────────
// clampOffsets: 줌이 minZoom 근처면 중앙으로 자연스럽게 수렴
// ──────────────────────────────────────────
function clampOffsets(instant = false) {
  const limit = getMaxOffset();
  const minZ = getMinZoom();
  const pullToCenter = map(zoom, minZ, minZ * 1.15, 1, 0, true);

  let targetX = constrain(offsetX, -limit.x, limit.x);
  let targetY = constrain(offsetY, -limit.y, limit.y);
  targetX *= (1 - pullToCenter);
  targetY *= (1 - pullToCenter);

  if (instant) {
    offsetX = targetX;
    offsetY = targetY;
  } else {
    offsetX = lerp(offsetX, targetX, 0.22);
    offsetY = lerp(offsetY, targetY, 0.22);
  }
}

// ──────────────────────────────────────────
// 모바일: 두 손가락 핀치 = 줌(중앙기준), 한 손가락 = 팬
// ──────────────────────────────────────────
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
  zoom = 1;
  offsetX = 0;
  offsetY = 0;
}

// ──────────────────────────────────────────
// 맥 트랙패드 두 손가락 = 휠 이벤트로 들어옴 → 중앙기준 줌
// ──────────────────────────────────────────
function mouseWheel(event) {
  let newZoom = zoom - event.delta * 0.001;
  applyZoomCenter(newZoom);
  return false;
}
