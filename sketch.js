let rings = [];

let input;

let baseRadius;
let gap;

const RESET_CODE = "1125";

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

let lastTouchDist = null;
let lastTapTime = 0;

let fonts = [];
let fontsReady = false;

let isComposing = false;

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

  db.ref("rings").on("value", (snapshot) => {
    const data = snapshot.val();
    rings = [];

    if (data) {
      Object.values(data).forEach((item) => {
        rings.push(item);
      });
    }

    clampOffsets(true);
  });
}

function handleInput(val) {
  if (!val) return;

  if (val === RESET_CODE) {
    db.ref("rings").remove();
  } else {
    db.ref("rings").push(createRing(val));
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

    // 🔥 각 링마다 랜덤 간격
    currentRadius += Number(ring.ringGap ?? gap);
  }
}

function createRing(text) {
  let sp = random(-0.6, 0.6);
  if (abs(sp) < 0.15) {
    sp = sp < 0 ? -0.15 : 0.15;
  }

  const r = floor(random(80, 220));
  const g = floor(random(80, 220));
  const b = floor(random(80, 220));

  const base = min(windowWidth, windowHeight);

  return {
    text: text,
    fontIndex: floor(random(fonts.length)),
    r: r,
    g: g,
    b: b,
    speed: sp,
    angleOffset: random(360),
    fontSize: random(10, 28),

    // 🔥 자간 랜덤 폭 다시 넓힘
    // 완전 딱 붙는 것만 방지
    spacingFactor: random(0.72, 1.45),

    wobble: random(-8, 8),

    // 🔥 링 사이 거리도 랜덤
    // 너무 붙어서 안 보이는 것만 방지
    ringGap: random(base * 0.055, base * 0.105),
  };
}

function drawTextCircle(ring, r) {
  const str = String(ring.text ?? "");
  let angle = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const charWidth = textWidth(char);

    // 🔥 최소 간격만 살짝 보장
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

function updateLayout() {
  const base = min(windowWidth, windowHeight);
  baseRadius = base * 0.12;
  gap = base * 0.08;
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
    currentRadius += Number(rings[i].ringGap ?? gap);
  }

  return currentRadius + 120;
}

function getMaxOffset() {
  const outerRadius = getOuterRadius() * zoom;

  const maxX = max(0, outerRadius - width * 0.22);
  const maxY = max(0, outerRadius - height * 0.22);

  return {
    x: maxX,
    y: maxY
  };
}

function clampOffsets(instant = false) {
  const limit = getMaxOffset();

  const targetX = constrain(offsetX, -limit.x, limit.x);
  const targetY = constrain(offsetY, -limit.y, limit.y);

  if (instant) {
    offsetX = targetX;
    offsetY = targetY;
  } else {
    offsetX = lerp(offsetX, targetX, 0.18);
    offsetY = lerp(offsetY, targetY, 0.18);
  }
}

function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - (width / 2 + offsetX)) / zoom,
    y: (screenY - (height / 2 + offsetY)) / zoom,
  };
}

function touchMoved() {
  if (touches.length === 2) {
    const x1 = touches[0].x;
    const y1 = touches[0].y;
    const x2 = touches[1].x;
    const y2 = touches[1].y;

    const d = dist(x1, y1, x2, y2);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    if (lastTouchDist !== null) {
      const prevZoom = zoom;
      const worldBefore = screenToWorld(midX, midY);

      let newZoom = zoom * (d / lastTouchDist);
      newZoom = constrain(newZoom, 0.3, 6);
      zoom = newZoom;

      offsetX = midX - width / 2 - worldBefore.x * zoom;
      offsetY = midY - height / 2 - worldBefore.y * zoom;

      if (zoom < prevZoom) {
        const zoomOutAmount = prevZoom - zoom;
        const t = constrain(zoomOutAmount * 0.35, 0.04, 0.12);
        offsetX = lerp(offsetX, 0, t);
        offsetY = lerp(offsetY, 0, t);
      }

      clampOffsets(false);
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
  const mouseWorldBefore = screenToWorld(mouseX, mouseY);
  const prevZoom = zoom;

  let newZoom = zoom - event.delta * 0.001;
  newZoom = constrain(newZoom, 0.3, 6);
  zoom = newZoom;

  offsetX = mouseX - width / 2 - mouseWorldBefore.x * zoom;
  offsetY = mouseY - height / 2 - mouseWorldBefore.y * zoom;

  if (zoom < prevZoom) {
    const zoomOutAmount = prevZoom - zoom;
    const t = constrain(zoomOutAmount * 0.35, 0.04, 0.12);
    offsetX = lerp(offsetX, 0, t);
    offsetY = lerp(offsetY, 0, t);
  }

  clampOffsets(false);
}
