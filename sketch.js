let rings = [];

let input;
let inputForm;

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

function preload() {
  fonts = [
    loadFont("./fonts/BagelFatOne-Regular.ttf"),
    loadFont("./fonts/Dongle-Regular.ttf"),
    loadFont("./fonts/GrandifloraOne-Regular.ttf"),
    loadFont("./fonts/MoiraiOne-Regular.ttf"),
    loadFont("./fonts/Orbit-Regular.ttf"),
    loadFont("./fonts/Sunflower-Medium.ttf"),
  ];
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  updateLayout();

  input = document.getElementById("mainInput");
  inputForm = document.getElementById("inputForm");

  fontsReady = Array.isArray(fonts) && fonts.length > 0;

  // 엔터 제출: form submit 방식
  inputForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleInput();
  });

  // 일부 환경에서 submit이 안 잡힐 때 대비
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInput();
    }
  });

  // 입력창 눌렀을 때 화면 튐 최소화
  input.addEventListener("focus", () => {
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
  });

  // Firebase 실시간 구독
  db.ref("rings").on(
    "value",
    (snapshot) => {
      const data = snapshot.val();
      rings = [];

      if (data) {
        Object.values(data).forEach((item) => {
          rings.push(item);
        });
      }
    },
    (error) => {
      console.error("Firebase read error:", error);
    }
  );
}

function handleInput() {
  const val = input.value.trim();
  if (val === "") return;

  if (val === RESET_CODE) {
    db.ref("rings").remove().catch((err) => {
      console.error("Firebase remove error:", err);
    });
  } else {
    db.ref("rings")
      .push(createRing(val))
      .catch((err) => {
        console.error("Firebase push error:", err);
      });
  }

  input.value = "";
  input.blur();
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
    if (!Number.isFinite(sp) || abs(sp) < 0.05) {
      sp = 0.2;
    }

    rotate(millis() * 0.02 * sp + Number(ring.angleOffset || 0));

    // fontIndex만 저장하고, 여기서 실제 폰트 객체로 매핑
    const fontIndex = Number.isInteger(ring.fontIndex)
      ? ring.fontIndex
      : parseInt(ring.fontIndex, 10);

    if (fontsReady && Number.isFinite(fontIndex) && fonts[fontIndex]) {
      textFont(fonts[fontIndex]);
    } else if (fontsReady && fonts[0]) {
      textFont(fonts[0]);
    }

    fill(
      Number(ring.r ?? 200),
      Number(ring.g ?? 150),
      Number(ring.b ?? 200)
    );
    noStroke();
    textSize(Number(ring.fontSize ?? 20));

    drawTextCircle(ring, radius);
    pop();
  }
}

function createRing(text) {
  let sp = random(-0.6, 0.6);
  if (abs(sp) < 0.15) {
    sp = sp < 0 ? -0.15 : 0.15;
  }

  return {
    text: text,

    // 폰트 객체 저장 금지: index만 저장
    fontIndex: floor(random(fonts.length)),

    r: floor(random(120, 256)),
    g: floor(random(120, 256)),
    b: floor(random(120, 256)),

    speed: sp,
    angleOffset: random(360),
    fontSize: random(12, 42),
    spacingFactor: random(0.5, 2.0),
    wobble: random(-8, 8),
  };
}

function drawTextCircle(ring, r) {
  const str = String(ring.text ?? "");
  let angle = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const charWidth = textWidth(char);

    const angleStep =
      (charWidth / (2 * PI * r)) * 360 * Number(ring.spacingFactor ?? 1);

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
  baseRadius = base * 0.1;
  gap = base * 0.06;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();

  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 50);
}

// 두 손가락 줌 / 한 손가락 이동
function touchMoved() {
  if (touches.length === 2) {
    const d = dist(
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

// 더블탭 리셋
function touchStarted() {
  const now = millis();
  if (now - lastTapTime < 300) {
    resetView();
  }
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

// 노트북 휠 줌
function mouseWheel(event) {
  zoom -= event.delta * 0.001;
  zoom = constrain(zoom, 0.3, 6);
}