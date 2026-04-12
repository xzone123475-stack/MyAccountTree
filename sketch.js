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

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const radius = baseRadius + i * gap;

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

    fill(ring.r, ring.g, ring.b);
    noStroke();

    // 🔥 화면 기준으로 글자 크기 조절
    textSize(ring.fontSize * (min(width, height) / 800));

    drawTextCircle(ring, radius);
    pop();
  }
}

// 🔥 폰트 크기도 저장할 때 기준 낮춤
function createRing(text) {
  let sp = random(-0.6, 0.6);
  if (abs(sp) < 0.15) {
    sp = sp < 0 ? -0.15 : 0.15;
  }

  return {
    text: text,
    fontIndex: floor(random(fonts.length)),
    r: random(120, 255),
    g: random(120, 255),
    b: random(120, 255),
    speed: sp,
    angleOffset: random(360),

    // 🔥 기존보다 작게
    fontSize: random(10, 28),

    spacingFactor: random(1.0, 1.8),
    wobble: random(-8, 8),
  };
}

// 🔥 겹침 완전 방지
function drawTextCircle(ring, r) {
  const str = ring.text;
  let angle = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const charWidth = textWidth(char);

    const minSpacing = 10;

    const angleStep =
      ((charWidth + minSpacing) / (2 * PI * r)) *
      360 *
      ring.spacingFactor;

    const x = cos(angle) * r;
    const y = sin(angle) * r;

    push();
    translate(x, y);
    rotate(angle + 90 + ring.wobble);
    textAlign(CENTER, CENTER);
    text(char, 0, 0);
    pop();

    angle += angleStep;
  }
}

// 🔥 간격 더 넓힘
function updateLayout() {
  let base = min(windowWidth, windowHeight);

  baseRadius = base * 0.12;

  // 🔥 핵심: gap 크게
  gap = base * 0.09;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();
}

function touchMoved() {
  if (touches.length === 2) {
    let d = dist(
      touches[0].x, touches[0].y,
      touches[1].x, touches[1].y
    );

    if (lastTouchDist) {
      zoom *= d / lastTouchDist;
      zoom = constrain(zoom, 0.3, 6);
    }

    lastTouchDist = d;
  }

  if (touches.length === 1) {
    offsetX += movedX;
    offsetY += movedY;
  }

  return false;
}

function touchStarted() {
  let now = millis();
  if (now - lastTapTime < 300) resetView();
  lastTapTime = now;
}

function touchEnded() {
  lastTouchDist = null;
}

function resetView() {
  zoom = 1;
  offsetX = 0;
  offsetY = 0;
}

function mouseWheel(event) {
  zoom -= event.delta * 0.001;
  zoom = constrain(zoom, 0.3, 6);
}