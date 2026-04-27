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

// 플래시 모션 상태
let flash = null; // { r,g,b, start, duration }
const FLASH_DURATION = 900; // ms
let prevRingsSnapshot = {}; // slotIndex → text 비교용

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

    const newSnapshot = {};

    if (data) {
      Object.values(data).forEach((item) => {
        const idx = Number(item.slotIndex ?? 0);
        if (idx >= 0 && idx < MAX_RINGS) {
          rings[idx] = item;
          newSnapshot[idx] = item.text;
        }
      });
    }

    // 새로 추가/변경된 링 감지 → 플래시 트리거
    for (const idx in newSnapshot) {
      if (prevRingsSnapshot[idx] !== newSnapshot[idx]) {
        const ring = rings[idx];
        if (ring) {
          triggerFlash(ring.r, ring.g, ring.b);
        }
        break;
      }
    }
    prevRingsSnapshot = newSnapshot;

    rings = rings.filter((r) => r !== null);
    clampOffsets(true);
  });
}

function triggerFlash(r, g, b) {
  flash = {
    r: Number(r ?? 160),
    g: Number(g ?? 160),
    b: Number(b ?? 160),
    start: millis(),
    duration: FLASH_DURATION,
  };
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

  push();
  translate(width / 2 + offsetX, height / 2 + offsetY);
  scale(zoom);

  let currentRadius = baseRadius;

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (!ring) continue;

    push();

    let sp = Number(ring.speed);
    if (!sp || abs(sp) < 0.075) sp = 0.3;

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
  pop();

  // 플래시 오버레이: 화면 전체 → 중앙점으로 수축
  drawFlash();
}

// ──────────────────────────────────────────
// 플래시: 화면을 가득 덮은 컬러 사각형이 중앙으로 수축하며 사라짐
// ──────────────────────────────────────────
function drawFlash() {
  if (!flash) return;

  const elapsed = millis() - flash.start;
  const t = elapsed / flash.duration;

  if (t >= 1) {
    flash = null;
    return;
  }

  // ease-in-cubic: 처음엔 천천히 줄다가 끝에서 빠르게 사라짐
  const eased = t * t * t;
  const scaleFactor = 1 - eased;
  const alpha = 255 * (1 - t * 0.3); // 끝까지 진하게 유지하다 살짝만 흐려짐

  const w = width * scaleFactor;
  const h = height * scaleFactor;

  push();
  resetMatrix();
  noStroke();
  fill(flash.r, flash.g, flash.b, alpha);
  rectMode(CENTER);
  rect(width / 2, height / 2, w, h);
  pop();
}

function createRing(text, slotIndex) {
  // 속도 다양성 1.5배 (기존 ±0.6 → ±0.9, 최소 0.15 → 0.225)
  let sp = random(-0.9, 0.9);
  if (abs(sp) < 0.225) {
    sp = sp < 0 ? -0.225 : 0.225;
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
// 줌: 순수 중앙 기준
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

function mouseWheel(event) {
  let newZoom = zoom - event.delta * 0.001;
  applyZoomCenter(newZoom);
  return false;
}
