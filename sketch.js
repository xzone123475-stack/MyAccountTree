let rings = [];
let input;

let isComposing = false; // 🔥 핵심

let baseRadius;
let gap;

const RESET_CODE = "1125";

let zoom = 1;
let offsetX = 0;
let offsetY = 0;

let lastTouchDist = null;
let lastTapTime = 0;

let fonts = [];

function preload() {
  fonts.push(loadFont("fonts/BagelFatOne-Regular.ttf"));
  fonts.push(loadFont("fonts/Dongle-Regular.ttf"));
  fonts.push(loadFont("fonts/GrandifloraOne-Regular.ttf"));
  fonts.push(loadFont("fonts/MoiraiOne-Regular.ttf"));
  fonts.push(loadFont("fonts/Orbit-Regular.ttf"));
  fonts.push(loadFont("fonts/Sunflower-Medium.ttf"));
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  updateLayout();

  input = document.getElementById("mainInput");

  // 🔥 한글 조합 시작/끝 감지
  input.addEventListener("compositionstart", () => {
    isComposing = true;
  });

  input.addEventListener("compositionend", () => {
    isComposing = false;
  });

  // 🔥 엔터 처리 (조합 아닐 때만)
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !isComposing) {
      e.preventDefault();
      handleInput();
    }
  });

  // Firebase
  db.ref("rings").on("value", (snapshot) => {
    let data = snapshot.val();
    rings = [];
    if (data) Object.values(data).forEach(item => rings.push(item));
  });
}

function handleInput() {
  let val = input.value.trim();
  if (val === "") return;

  if (val === RESET_CODE) {
    db.ref("rings").remove();
  } else {
    db.ref("rings").push(createRing(val));
  }

  input.value = "";
}

function draw() {
  background(255);

  translate(width/2 + offsetX, height/2 + offsetY);
  scale(zoom);

  rings.forEach((ring, i) => {
    let radius = baseRadius + i * gap;

    push();

    let sp = Number(ring.speed);
    if (!sp || abs(sp) < 0.05) sp = 0.2;

    rotate(millis() * 0.02 * sp + ring.angleOffset);

    textFont(ring.font);
    fill(ring.r, ring.g, ring.b);
    noStroke();
    textSize(ring.fontSize);

    drawTextCircle(ring, radius);
    pop();
  });
}

function createRing(text) {
  let sp = random(-0.6, 0.6);
  if (abs(sp) < 0.15) sp = sp < 0 ? -0.15 : 0.15;

  return {
    text: text,
    font: random(fonts),

    r: random(120,255),
    g: random(120,255),
    b: random(120,255),

    speed: sp,
    angleOffset: random(360),
    fontSize: random(12, 42),
    spacingFactor: random(0.5, 2.0),
    wobble: random(-8, 8)
  };
}

function updateLayout() {
  let base = min(windowWidth, windowHeight);
  baseRadius = base * 0.1;
  gap = base * 0.06;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();
}

function drawTextCircle(ring, r) {
  let str = ring.text;
  let angle = 0;

  for (let i = 0; i < str.length; i++) {
    let char = str[i];
    let charWidth = textWidth(char);

    let angleStep =
      (charWidth / (2 * PI * r)) * 360 * ring.spacingFactor;

    let x = cos(angle) * r;
    let y = sin(angle) * r;

    push();
    translate(x, y);
    rotate(angle + 90 + ring.wobble);
    textAlign(CENTER, CENTER);
    text(char, 0, 0);
    pop();

    angle += angleStep;
  }
}

// 터치 이동
function touchMoved() {
  if (touches.length === 2) {
    let d = dist(touches[0].x, touches[0].y, touches[1].x, touches[1].y);
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