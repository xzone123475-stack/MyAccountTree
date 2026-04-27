let rings = [];
let input;

let zoom = 1;
let minZoom = 1;

let speedLevel = 1;

let flashColor = null;
let flashRadius = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);

  input = document.getElementById("mainInput");

  // speed UI
  document.querySelectorAll(".speedBtn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".speedBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      speedLevel = Number(btn.dataset.speed);
    };
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleInput(input.value.trim());
    }
  });

  db.ref("rings").on("value", (snapshot) => {
    let data = snapshot.val();
    rings = data ? Object.values(data) : [];

    // 🔥 최대 7줄 유지
    if (rings.length > 7) {
      let removeCount = rings.length - 7;
      let keys = Object.keys(data);
      for (let i = 0; i < removeCount; i++) {
        db.ref("rings/" + keys[i]).remove();
      }
    }

    updateMinZoom();
  });
}

function handleInput(val) {
  if (!val) return;

  let color = {
    r: random(80, 220),
    g: random(80, 220),
    b: random(80, 220)
  };

  // 🔥 로컬 애니메이션 (본인만)
  flashColor = color;
  flashRadius = max(width, height) * 1.2;

  db.ref("rings").push({
    text: val,
    color: color,
    speed: speedLevel,
    fontSize: random(12, 42) // 🔥 1.5배 확대
  });

  input.value = "";
}

function draw() {
  background(255);

  translate(width/2, height/2);
  scale(zoom);

  let r = 80;

  for (let i = 0; i < rings.length; i++) {
    let ring = rings[i];

    push();
    rotate(frameCount * 0.2 * ring.speed);

    fill(ring.color.r, ring.color.g, ring.color.b);
    noStroke();

    textSize(ring.fontSize);

    drawCircleText(ring.text, r);
    pop();

    r += random(50, 120); // 🔥 링 간격 랜덤
  }

  // 🔥 화면 덮였다가 빨려들어가는 애니메이션
  if (flashColor) {
    push();
    noStroke();
    fill(flashColor.r, flashColor.g, flashColor.b);
    circle(width/2, height/2, flashRadius);
    pop();

    flashRadius *= 0.85;

    if (flashRadius < 10) flashColor = null;
  }
}

function drawCircleText(txt, r) {
  let angle = 0;

  for (let c of txt) {
    let w = textWidth(c) + 5;

    let step = (w / (2 * PI * r)) * 360;

    let x = cos(angle) * r;
    let y = sin(angle) * r;

    push();
    translate(x, y);
    rotate(angle + 90);
    textAlign(CENTER, CENTER);
    text(c, 0, 0);
    pop();

    angle += step;
  }
}

function updateMinZoom() {
  let outer = rings.length * 120;
  minZoom = constrain(width / (outer + 200), 0.3, 1);
}

function mouseWheel(e) {
  zoom -= e.delta * 0.001;
  zoom = constrain(zoom, minZoom, 3);
}

function touchMoved() {
  if (touches.length === 2) {
    let d = dist(
      touches[0].x, touches[0].y,
      touches[1].x, touches[1].y
    );

    if (this.lastD) {
      zoom *= d / this.lastD;
      zoom = constrain(zoom, minZoom, 3);
    }
    this.lastD = d;
  }
}
