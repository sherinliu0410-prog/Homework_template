let footprints = [];
let snow;
let fallingSnow = [];

const SEED = 20260930;

// ============================================================
// SETUP
// ============================================================

function setup() {
  createCanvas(windowWidth, windowHeight);

  pixelDensity(1);

  randomSeed(SEED);
  noiseSeed(SEED);

  createSnow();
  createFootprints();
  createFallingSnow();
}

// ============================================================
// DRAW
// ============================================================

function draw() {
  image(snow, 0, 0, width, height);

  for (let fp of footprints) {
    fp.update();
    fp.display();
  }

  drawFallingSnow();
}

// ============================================================
// CREATE FALLING SNOW
// ============================================================

function createFallingSnow() {
  fallingSnow = [];

  randomSeed(SEED + 100);

  // NORMAL SNOW

  for (let i = 0; i < 220; i++) {
    let column = i % 22;

    let row = floor(i / 22);

    let cellW = width / 22;

    let cellH = height / 10;

    let baseX = column * cellW + random(cellW * 0.15, cellW * 0.85);

    fallingSnow.push({
      baseX: baseX,

      x: baseX,

      y: row * cellH - height + random(cellH),

      size: random(4, 7),

      speed: random(0.9, 1.9),

      drift: random(0.2, 0.6),

      opacity: random(175, 230),

      phase: random(TWO_PI),
    });
  }

  // MEDIUM SNOW

  for (let i = 0; i < 55; i++) {
    let column = i % 11;

    let row = floor(i / 11);

    let cellW = width / 11;

    let cellH = height / 5;

    let baseX = column * cellW + random(cellW * 0.2, cellW * 0.8);

    fallingSnow.push({
      baseX: baseX,

      x: baseX,

      y: row * cellH - height + random(cellH),

      size: random(7, 10),

      speed: random(1.1, 2.1),

      drift: random(0.25, 0.7),

      opacity: random(190, 240),

      phase: random(TWO_PI),
    });
  }

  // FEW LARGE SNOW

  for (let i = 0; i < 12; i++) {
    let column = i % 6;

    let row = floor(i / 6);

    let cellW = width / 6;

    let cellH = height / 2;

    let baseX = column * cellW + random(cellW * 0.25, cellW * 0.75);

    fallingSnow.push({
      baseX: baseX,

      x: baseX,

      y: row * cellH - height + random(cellH),

      size: random(10, 12),

      speed: random(1.3, 2.3),

      drift: random(0.3, 0.8),

      opacity: random(205, 245),

      phase: random(TWO_PI),
    });
  }

  randomSeed(SEED);
}

// ============================================================
// DRAW FALLING SNOW
// ============================================================

function drawFallingSnow() {
  noStroke();

  for (let flake of fallingSnow) {
    flake.y += flake.speed;

    flake.x = flake.baseX + sin(frameCount * 0.012 + flake.phase) * flake.drift;

    if (flake.y > height + 15) {
      flake.y = random(-100, -10);

      flake.x = flake.baseX;
    }

    if (flake.x < -15) {
      flake.x = width + 15;
    }

    if (flake.x > width + 15) {
      flake.x = -15;
    }

    fill(255, 255, 255, flake.opacity);

    ellipse(
      flake.x,
      flake.y,

      flake.size,
      flake.size,
    );
  }
}

// ============================================================
// CREATE SNOW GROUND
// ============================================================

function createSnow() {
  snow = createGraphics(900, 650);

  snow.pixelDensity(1);

  snow.noiseSeed(SEED);

  snow.background(232, 237, 237);

  // LARGE SOFT SNOW MASSES

  snow.noStroke();

  randomSeed(SEED + 1);

  for (let i = 300; i--; ) {
    let x = random(snow.width);

    let y = random(snow.height);

    let w = random(80, 260);

    let h = random(30, 120);

    snow.fill(255, 255, 255, random(7, 20));

    snow.ellipse(x, y, w, h);
  }

  // NATURAL SNOW SURFACE

  randomSeed(SEED + 2);

  for (let i = 700; i--; ) {
    let x = random(snow.width);

    let y = random(snow.height);

    let size = random(5, 35);

    snow.fill(255, 255, 255, random(12, 38));

    snow.ellipse(
      x,
      y,

      size,
      size * random(0.4, 0.8),
    );
  }

  // SOFT SNOW RIDGES

  randomSeed(SEED + 3);

  for (let i = 120; i--; ) {
    let x = random(snow.width);

    let y = random(snow.height);

    let w = random(30, 120);

    snow.noFill();

    snow.stroke(255, 255, 255, random(20, 50));

    snow.strokeWeight(random(1, 3));

    snow.beginShape();

    for (let j = 0; j < 8; j++) {
      let px = x + map(j, 0, 7, -w / 2, w / 2);

      let py = y + sin(j * 0.8 + random(1)) * random(2, 8);

      snow.vertex(px, py);
    }

    snow.endShape();
  }

  // SMALL SNOW PARTICLES

  randomSeed(SEED + 4);

  snow.noStroke();

  for (let i = 2500; i--; ) {
    let x = random(snow.width);

    let y = random(snow.height);

    let size = random(0.5, 2.2);

    snow.fill(215, 227, 229, random(15, 55));

    snow.ellipse(x, y, size, size);
  }

  // SOFT BLUE-GRAY SHADOW CLOUDS

  randomSeed(SEED + 5);

  for (let i = 55; i--; ) {
    let x = random(snow.width);

    let y = random(snow.height);

    snow.fill(170, 195, 200, random(4, 10));

    snow.ellipse(
      x,
      y,

      random(80, 220),

      random(20, 70),
    );
  }
}

// ============================================================
// CREATE FOOTPRINTS
// ============================================================

function createFootprints() {
  footprints = [];

  let count = 11;

  for (let i = 0; i < count; i++) {
    let t = i / (count - 1);

    let centerX = width * 0.5 + sin(t * PI * 1.05) * width * 0.1;

    let y = lerp(height * 0.08, height * 0.94, t);

    let side = i % 2 === 0 ? -1 : 1;

    let stepWidth = lerp(17, 30, t);

    let x = centerX + side * stepWidth;

    let scaleValue = lerp(0.38, 1.12, t);

    let rotation = side * 0.06 + sin(i * 2.1) * 0.025;

    footprints.push(new Footprint(x, y, scaleValue, rotation, i));
  }
}

// ============================================================
// FOOTPRINT CLASS
// ============================================================

class Footprint {
  constructor(x, y, scaleValue, rotation, index) {
    this.x = x;

    this.y = y;

    this.scale = scaleValue;

    this.rotation = rotation;

    this.index = index;

    this.spreading = false;

    this.progress = 0;
  }

  // ----------------------------------------------------------
  // START SPREAD
  // ----------------------------------------------------------

  startSpread() {
    if (this.spreading) {
      return;
    }

    this.spreading = true;

    this.progress = 0;
  }

  // ----------------------------------------------------------
  // UPDATE
  // ----------------------------------------------------------

  update() {
    if (!this.spreading) {
      return;
    }

    this.progress += 0.018;

    if (this.progress >= 1) {
      this.progress = 1;
    }
  }

  // ----------------------------------------------------------
  // DISPLAY
  // ----------------------------------------------------------

  display() {
    // ========================================================
    // NORMAL
    // ========================================================

    if (!this.spreading) {
      push();

      translate(this.x, this.y);

      rotate(this.rotation);

      scale(this.scale);

      drawRealFootprint(1, this.index);

      pop();

      return;
    }

    // ========================================================
    // SPREADING
    // ========================================================

    let p = smoothStep(this.progress);

    // --------------------------------------------------------
    // OUTER SOFT SPREAD
    // --------------------------------------------------------

    let spreadScale = 1 + p * 0.3;

    let outerAlpha = 45 * (1 - p);

    if (outerAlpha > 0) {
      push();

      translate(this.x, this.y);

      rotate(this.rotation);

      scale(this.scale * spreadScale);

      noFill();

      stroke(145, 170, 175, outerAlpha);

      strokeWeight(5);

      drawSoftFootprint(1);

      pop();
    }

    // --------------------------------------------------------
    // SECOND SOFT LAYER
    // --------------------------------------------------------

    let softAlpha = 35 * (1 - p);

    if (softAlpha > 0) {
      push();

      translate(this.x, this.y);

      rotate(this.rotation);

      scale(this.scale * (1 + p * 0.18));

      noFill();

      stroke(175, 195, 198, softAlpha);

      strokeWeight(8);

      drawSoftFootprint(1);

      pop();
    }

    // --------------------------------------------------------
    // ORIGINAL FOOTPRINT
    // --------------------------------------------------------

    let mainAlpha = 1 - p;

    if (mainAlpha > 0) {
      push();

      translate(this.x, this.y);

      rotate(this.rotation);

      let sx = this.scale * (1 + p * 0.1);

      let sy = this.scale * (1 + p * 0.07);

      scale(sx, sy);

      drawRealFootprint(mainAlpha, this.index);

      pop();
    }
  }
}

// ============================================================
// DRAW REAL FOOTPRINT
// ============================================================

function drawRealFootprint(amount, index) {
  push();

  let silhouette = [
    [-11, -39],
    [-17, -34],
    [-19, -25],
    [-18, -14],
    [-16, -4],
    [-13, 5],
    [-12, 15],
    [-14, 25],
    [-13, 34],
    [-8, 40],
    [0, 43],
    [9, 40],
    [13, 34],
    [14, 25],
    [12, 15],
    [13, 5],
    [16, -5],
    [18, -15],
    [17, -26],
    [13, -35],
    [7, -40],
    [0, -42],
  ];

  // MAIN DEPRESSION

  noStroke();

  fill(137, 163, 169, 20 * amount);

  beginShape();

  for (let p of silhouette) {
    vertex(p[0], p[1]);
  }

  endShape(CLOSE);

  // INNER SHADOW

  fill(116, 148, 156, 31 * amount);

  beginShape();

  for (let p of silhouette) {
    vertex(p[0] * 0.88, p[1] * 0.92);
  }

  endShape(CLOSE);

  // DEEP CENTER

  fill(105, 139, 148, 18 * amount);

  beginShape();

  for (let p of silhouette) {
    vertex(p[0] * 0.65, p[1] * 0.72);
  }

  endShape(CLOSE);

  // SNOW INSIDE

  drawSnowInside(amount, index);

  // SNOW RIDGE

  noFill();

  stroke(255, 255, 255, 100 * amount);

  strokeWeight(2.2);

  beginShape();

  for (let p of silhouette) {
    vertex(p[0] * 0.94, p[1] * 0.96);
  }

  endShape(CLOSE);

  // SOLE TEXTURE

  stroke(184, 204, 207, 25 * amount);

  strokeWeight(1);

  for (let i = -2; i <= 2; i++) {
    line(
      -7,
      i * 11 - 5,

      7,
      i * 11 - 5,
    );
  }

  pop();
}

// ============================================================
// SOFT FOOTPRINT OUTLINE
// ============================================================

function drawSoftFootprint(amount) {
  let silhouette = [
    [-11, -39],
    [-17, -34],
    [-19, -25],
    [-18, -14],
    [-16, -4],
    [-13, 5],
    [-12, 15],
    [-14, 25],
    [-13, 34],
    [-8, 40],
    [0, 43],
    [9, 40],
    [13, 34],
    [14, 25],
    [12, 15],
    [13, 5],
    [16, -5],
    [18, -15],
    [17, -26],
    [13, -35],
    [7, -40],
    [0, -42],
  ];

  beginShape();

  for (let p of silhouette) {
    curveVertex(p[0], p[1]);
  }

  endShape(CLOSE);
}

// ============================================================
// SNOW INSIDE FOOTPRINT
// ============================================================

function drawSnowInside(amount, index) {
  randomSeed(SEED + index * 100);

  noStroke();

  for (let i = 0; i < 13; i++) {
    let x = random(-11, 11);

    let y = random(-34, 34);

    let w = random(3, 10);

    let h = random(2, 8);

    fill(226, 235, 235, 125 * amount);

    ellipse(x, y, w, h);
  }

  randomSeed(SEED);
}

// ============================================================
// MOUSE INTERACTION
// ============================================================

function mousePressed() {
  checkFootprint(mouseX, mouseY);

  return false;
}

// ============================================================
// TOUCH INTERACTION
// ============================================================

function touchStarted() {
  if (touches.length > 0) {
    checkFootprint(touches[0].x, touches[0].y);
  }

  return false;
}

// ============================================================
// CHECK FOOTPRINT
// ============================================================

function checkFootprint(px, py) {
  for (let i = footprints.length - 1; i >= 0; i--) {
    let fp = footprints[i];

    if (fp.spreading) {
      continue;
    }

    let dx = px - fp.x;

    let dy = py - fp.y;

    let distance = sqrt(dx * dx + dy * dy);

    let hitRadius = 48 * fp.scale;

    if (distance < hitRadius) {
      fp.startSpread();

      break;
    }
  }
}

// ============================================================
// SMOOTH STEP
// ============================================================

function smoothStep(t) {
  t = constrain(t, 0, 1);

  return t * t * (3 - 2 * t);
}

// ============================================================
// WINDOW RESIZE
// ============================================================

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  createSnow();

  createFootprints();

  createFallingSnow();
}
