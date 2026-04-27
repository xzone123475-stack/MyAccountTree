let rings = [];

let input;

let baseRadius;
let gap;

const RESET_CODE = "김지예";
const MAX_RINGS = 7;

let zoom = 1;
let minZoom = 0.3;

let lastTouchDist = null;
let lastTapTime = 0;

let fonts = [];
let fontsReady = false;

let isComposing = false;

let selectedSpeedLevel = 1;

// 입력한 기기에서만 보이는 컬러 원형 애니메이션
let localFlash = {
  active: false,
  r: 0,
  g: 0,
  b: 0,
  diameter: 0,
  maxDiameter: 0,
  shrinkSpeed: 0.88
};

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

  setupSpeedButtons();

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
    const loaded = [];

    snapshot.forEach((child) => {
      loaded.push({
        key: child.key,
        ...child.val()
      });
    });

    loaded.sort((a, b) => {
      const at = Number(a.createdAt ?? 0);
      const bt = Number(b.createdAt ?? 0);
      if (at !== bt) return at - bt;
      return String(a.key).localeCompare(String(b.key));
    });

    rings = loaded.slice(-MAX_RINGS);

    removeOverflowRings(loaded);
    updateMinZoom();
    zoom = constrain(zoom, minZoom, 6);
  });
}

function setupSpeedButtons() {
  const buttons = document.querySelectorAll(".speedBtn");

  if (!buttons || buttons.length === 0) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const value = Number(btn.dataset.speed);
      selectedSpeedLevel = Number.isFinite(value) ? constrain(value, 1, 5) : 1;
    });
  });
}

function handleInput(val) {
  if (!val) return;

  if (val === RESET_CODE) {
    db.ref("rings").remove();
    input.value = "";
    return;
  }

  const newRing = createRing(val);

  startLocalFlash(newRing.r, newRing.g, newRing.b);

  db.ref("rings").push(newRing).then(() => {
    enforceMaxRingsOnce();
  });

  input.value = "";
}

function removeOverflowRings(allRings) {
  if (!Array.isArray(allRings)) return;
  if (allRings.length <= MAX_RINGS) return;

  const removeCount = allRings.length - MAX_RINGS;
  const targets = allRings.slice(0, removeCount);

  targets.forEach((ring) => {
    if (ring.key) {
      db.ref("rings/" + ring.key).remove();
    }
  });
}

function enforceMaxRingsOnce() {
  db.ref("rings").once("value").then((snapshot) => {
    const loaded = [];

    snapshot.forEach((child) => {
      loaded.push({
        key: child.key,
        ...child.val()
      });
    });

    loaded.sort((a, b) => {
      const at = Number(a.createdAt ?? 0);
      const bt = Number(b.createdAt ?? 0);
      if (at !== bt) return at - bt;
      return String(a.key).localeCompare(String(b.key));
    });

    removeOverflowRings(loaded);
  });
}

function draw() {
  background(255);

  push();
  translate(width / 2, height / 2);
  scale(zoom);

  let currentRadius = baseRadius;

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];

    push();

    let sp = Number(ring.speed);
    if (!Number.isFinite(sp) || abs(sp) < 0.03) {
      sp = 0.08;
    }

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

    currentRadius += Number(ring.ringGap ?? gap);
  }

  pop();

  drawLocalFlash();
}

function createRing(text) {
  const speedValue = getSpeedFromLevel(selectedSpeedLevel);
  const direction = random() < 0.5 ? -1 : 1;
  const sp = speedValue * direction;

  const col = getReadableRandomColor();

  const base = min(windowWidth, windowHeight);

  return {
    text: text,
    fontIndex: floor(random(fonts.length)),
    r: col.r,
    g: col.g,
    b: col.b,
    speed: sp,
    speedLevel: selectedSpeedLevel,
    angleOffset: random(360),

    // 기존보다 더 다이나믹하지만 모바일 기준으로 너무 과하지 않게
    fontSize: random(8, 36),

    // 기존 자간 랜덤성 유지
    spacingFactor: random(0.72, 1.45),

    wobble: random(-8, 8),

    // 나무테 사이 거리도 랜덤 유지
    ringGap: random(base * 0.055, base * 0.105),

    createdAt: Date.now()
  };
}

function getSpeedFromLevel(level) {
  const lv = constrain(Number(level) || 1, 1, 5);

  // 기존보다 전체 0.5배 정도 느리게
  const speedMap = {
    1: 0.075,
    2: 0.15,
    3: 0.225,
    4: 0.3,
    5: 0.375
  };

  return speedMap[lv] ?? 0.075;
}

function getReadableRandomColor() {
  let r, g, b, brightness;

  let tries = 0;

  do {
    r = floor(random(70, 215));
    g = floor(random(70, 215));
    b = floor(random(70, 215));

    brightness = r * 0.299 + g * 0.587 + b * 0.114;
    tries++;
  } while ((brightness > 205 || brightness < 75) && tries < 50);

  return { r, g, b };
}

function startLocalFlash(r, g, b) {
  localFlash.active = true;
  localFlash.r = r;
  localFlash.g = g;
  localFlash.b = b;

  localFlash.maxDiameter = sqrt(width * width + height * height) * 1.35;
  localFlash.diameter = localFlash.maxDiameter;
  localFlash.shrinkSpeed = 0.88;
}

function drawLocalFlash() {
  if (!localFlash.active) return;

  push();
  resetMatrix();
  noStroke();
  fill(localFlash.r, localFlash.g, localFlash.b);
  circle(width / 2, height / 2, localFlash.diameter);
  pop();

  localFlash.diameter *= localFlash.shrinkSpeed;

  if (localFlash.diameter < 8) {
    localFlash.active = false;
  }
}

function drawTextCircle(ring, r) {
  const str = String(ring.text ?? "");
  let angle = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const charWidth = textWidth(char);

    // 완전 딱 붙는 것만 방지
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

  updateMinZoom();
}

function getOuterRadius() {
  if (rings.length <= 0) return baseRadius + 80;

  let currentRadius = baseRadius;

  for (let i = 0; i < rings.length; i++) {
    currentRadius += Number(rings[i].ringGap ?? gap);
  }

  return currentRadius + 120;
}

function updateMinZoom() {
  const outerRadius = getOuterRadius();

  if (!outerRadius || outerRadius <= 0) {
    minZoom = 0.3;
    return;
  }

  // 축소했을 때 텍스트 원 영역이 화면보다 과하게 작아지지 않도록 제한
  const target = (min(width, height) * 0.46) / outerRadius;

  minZoom = constrain(target, 0.3, 1);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();
  zoom = constrain(zoom, minZoom, 6);

  if (localFlash.active) {
    localFlash.maxDiameter = sqrt(width * width + height * height) * 1.35;
    localFlash.diameter = min(localFlash.diameter, localFlash.maxDiameter);
  }
}

function touchMoved() {
  if (touches.length === 2) {
    const d = dist(
      touches[0].x,
      touches[0].y,
      touches[1].x,
      touches[1].y
    );

    if (lastTouchDist !== null) {
      let newZoom = zoom * (d / lastTouchDist);
      zoom = constrain(newZoom, minZoom, 6);
    }

    lastTouchDist = d;
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
}

function mouseWheel(event) {
  let newZoom = zoom - event.delta * 0.001;
  zoom = constrain(newZoom, minZoom, 6);
}
