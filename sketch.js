let rings = [];

let input;

let baseRadius;

const RESET_CODE = "1125";
const MAX_RINGS = 7;

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

let lastTouchDist = null;
let lastTapTime = 0;

let fonts = [];
let fontsReady = false;

let isComposing = false;

// ──────────────────────────────────────────
// 링 간격 계산: fontSize 기반으로 딱 붙게
// ──────────────────────────────────────────
function getRingGap(ring) {
  // 폰트 크기 + 약간의 여백(4px)만 확보
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

  input.addEventListener("compositionstart", () => {
    isComposing = true;
  });

  input.addEventListener("compositionend", () => {
    isComposing = false;
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (isComposing) return;
      handleInput(input.value.trim());
    }
  });

  // Firebase: 슬롯 기반(slot0~slot6) 구조로 읽기
  // 순서는 slotIndex로 정렬
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

    // null 슬롯 제거하여 연속 배열로 압축 (순서 유지)
    rings = rings.filter((r) => r !== null);

    clampOffsets(true);
  });
}

// ──────────────────────────────────────────
// handleInput: 트랜잭션으로 race condition 방지
// 40명 동시접속 시에도 nextSlot 충돌 없음
// ──────────────────────────────────────────
function handleInput(val) {
  if (!val) return;

  if (val === RESET_CODE) {
    db.ref("rings").remove();
    db.ref("meta").remove();
  } else {
    // meta/nextSlot을 트랜잭션으로 원자적 업데이트
    // 트랜잭션 내부에서 slot을 +1 증가시켜야 race condition 없음
    db.ref("meta/nextSlot").transaction((currentSlot) => {
      const slot = (currentSlot ?? 0) % MAX_RINGS;
      return (slot + 1) % MAX_RINGS; // 다음 슬롯으로 원자적 전진
    }).then((result) => {
      if (!result.committed) return;

      // 트랜잭션이 저장한 값은 "다음" 슬롯이므로
      // 현재 쓸 슬롯 = (저장된 값 - 1 + MAX_RINGS) % MAX_RINGS
      const nextSlot = result.snapshot.val();
      const slotIndex = (nextSlot - 1 + MAX_RINGS) % MAX_RINGS;

      // 해당 슬롯에 링 데이터 쓰기 (슬롯 key로 고정)
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

    // 간격: fontSize 기반으로 딱 붙게
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
    fontSize: random(20, 56),
    spacingFactor: random(0.72, 1.45),
    wobble: random(-8, 8),
    // ringGap은 클라이언트에서 getRingGap()으로 계산하므로 저장 안 함
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
// 최소 줌: 7개 링 전체가 화면 안에 들어오는 수준
// ──────────────────────────────────────────
function getMinZoom() {
  const outerR = getOuterRadius(); // zoom=1 기준 외곽 반지름
  if (outerR <= 0) return 0.3;
  // 화면 짧은 변의 절반과 비교해 딱 맞는 zoom 계산, 최소 0.15 보장
  const fitZoom = (min(width, height) * 0.48) / outerR;
  return max(0.15, fitZoom);
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

  const targetX = constrain(offsetX, -limit.x, limit.x);
  const targetY = constrain(offsetY, -limit.y, limit.y);

  if (instant) {
    offsetX = targetX;
    offsetY = targetY;
  } else {
    offsetX = lerp(offsetX, targetX, 0.22);
    offsetY = lerp(offsetY, targetY, 0.22);
  }
}

// ──────────────────────────────────────────
// 줌: 항상 화면 중앙 기준으로만 동작
// ──────────────────────────────────────────
function applyZoomCenter(newZoom) {
  const minZoom = getMinZoom();
  zoom = constrain(newZoom, minZoom, 6);
  // zoom 축소 시 offset을 중앙으로 자연스럽게 복귀
  const centerRatio = map(zoom, minZoom, 1.0, 0.0, 1.0, true);
  offsetX *= centerRatio;
  offsetY *= centerRatio;
  clampOffsets(false);
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
      newZoom = constrain(newZoom, getMinZoom(), 6);
      applyZoomCenter(newZoom);
    }

    lastTouchDist = d;
  }

  if (touches.length === 1) {
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
  newZoom = constrain(newZoom, getMinZoom(), 6);
  applyZoomCenter(newZoom);
}
