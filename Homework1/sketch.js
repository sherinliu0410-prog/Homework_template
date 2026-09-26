let engine;
let note;

let whiteKeys = [];
let blackKeys = [];

let targets = [1, 3, 7];

let stage = 0;
let progress = 0;

// ====================
// 음표 색상
// ====================

let noteColors = [
  [0, 255, 170],   // 민트 그린
  [255, 0, 149],   // 마젠타
  [0, 208, 255],   // 블루
];

let currentNoteColor = [25, 25, 25];

// ====================
// 작은 음표 효과
// ====================

let smallNotes = [];

// ====================
// 마지막 음표 효과
// ====================

let finalNoteAlpha = 255;
let finalTimer = 0;
let finalFade = false;


function setup() {
  createCanvas(windowWidth, windowHeight);

  // ====================
  // Matter.js 설정
  // ====================

  engine = Matter.Engine.create();
  engine.gravity.y = 0;

  // ====================
  // 음표
  // ====================

  note = Matter.Bodies.circle(100, 120, 23, {
    restitution: 1,
    friction: 0,
  });

  Matter.Composite.add(engine.world, note);

  // ====================
  // 흰 건반
  // ====================

  for (let i = 0; i < 8; i++) {
    let x = width / 2 - 330 + i * 94;

    let key = Matter.Bodies.rectangle(
      x,
      height - 120,
      92,
      185,
      {
        isStatic: true,
      }
    );

    whiteKeys.push({
      body: key,
      down: 0,
    });

    Matter.Composite.add(engine.world, key);
  }

  // ====================
  // 검은 건반
  // ====================

  let positions = [-235, -141, 47, 141, 235];

  for (let x of positions) {
    blackKeys.push({
      x: width / 2 + x,
      y: height - 180,
    });
  }
}


function draw() {
  background(240);

  Matter.Engine.update(engine);

  // ====================
  // 음표 움직임
  // ====================

  if (stage < 3) {
    let startX;
    let startY;

    let endX;
    let endY;

    // ====================
    // 첫 번째
    // 왼쪽 위 → 두 번째 건반
    // ====================

    if (stage == 0) {
      startX = 100;
      startY = 120;

      endX = getKeyX(1);
      endY = height - 175;
    }

    // ====================
    // 두 번째
    // 두 번째 → 네 번째 건반
    // ====================

    else if (stage == 1) {
      startX = getKeyX(1);
      startY = height - 175;

      endX = getKeyX(3);
      endY = height - 175;
    }

    // ====================
    // 세 번째
    // 네 번째 → 가장 오른쪽 건반
    // ====================

    else {
      startX = getKeyX(3);
      startY = height - 175;

      endX = getKeyX(7);
      endY = height - 210;
    }

    // ====================
    // 움직임 속도
    // ====================

    progress += 0.012;

    // ====================
    // 튀어 오르는 최고점
    // ====================

    let peakY = -80;

    // ====================
    // 포물선 움직임
    // ====================

    let x = lerp(startX, endX, progress);

    let y =
      (1 - progress) * (1 - progress) * startY +
      2 * (1 - progress) * progress * peakY +
      progress * progress * endY;

    // ====================
    // 음표 위치 업데이트
    // ====================

    Matter.Body.setPosition(note, {
      x: x,
      y: y,
    });

    // ====================
    // 건반에 도착
    // ====================

    if (progress >= 1) {
      progress = 0;

      // 현재 건반
      let keyIndex = targets[stage];

      // 건반을 아래로 누름
      whiteKeys[keyIndex].down = 12;

      // ====================
      // 음표 색상 변경
      // ====================

      currentNoteColor = [
        noteColors[stage][0],
        noteColors[stage][1],
        noteColors[stage][2],
      ];

      // ====================
      // 작은 음표 생성
      // ====================

      smallNotes.push({
        x: note.position.x,
        y: note.position.y + 5,

        size: 20,

        alpha: 220,

        color: [
          noteColors[stage][0],
          noteColors[stage][1],
          noteColors[stage][2],
        ],
      });

      stage++;
    }
  }

  // ====================
  // 마지막 위치
  // ====================

  if (stage >= 3) {
    Matter.Body.setPosition(note, {
      x: getKeyX(7),
      y: height - 210,
    });

    // ====================
    // 마지막 음표 대기
    // ====================

    if (!finalFade) {
      finalTimer++;

      // 약 1초 대기
      if (finalTimer > 60) {
        finalFade = true;
      }
    }

    // ====================
    // 마지막 음표 페이드 아웃
    // ====================

    if (finalFade) {
      finalNoteAlpha -= 3;

      if (finalNoteAlpha < 0) {
        finalNoteAlpha = 0;
      }
    }
  }

  // ====================
  // 건반 복원
  // ====================

  for (let key of whiteKeys) {
    if (key.down > 0) {
      key.down -= 0.35;

      if (key.down < 0) {
        key.down = 0;
      }
    }
  }

  // ====================
  // 피아노 외곽 프레임
  // ====================

  let pianoX = width / 2 - 410;
  let pianoY = height - 225;

  fill(35);
  noStroke();

  // 위쪽 프레임
  rect(pianoX, pianoY, 820, 40);

  // 왼쪽 프레임
  rect(pianoX, pianoY, 24, 225);

  // 오른쪽 프레임
  rect(pianoX + 796, pianoY, 24, 225);

  // 아래쪽 프레임
  rect(pianoX, height - 55, 820, 50);

  // ====================
  // 흰 건반
  // ====================

  for (let key of whiteKeys) {
    let y = key.body.position.y + key.down;

    fill(250);
    stroke(50);

    rect(
      key.body.position.x - 46,
      y - 92,
      92,
      185
    );
  }

  // ====================
  // 검은 건반
  // ====================

  fill(25);
  noStroke();

  for (let key of blackKeys) {
    rect(
      key.x - 25,
      key.y - 48,
      50,
      96
    );
  }

  // ====================
  // 작은 음표
  // ====================

  drawSmallNotes();

  // ====================
  // 메인 음표
  // ====================

  drawNote(
    note.position.x,
    note.position.y
  );
}


// ====================
// 작은 음표 그리기
// ====================

function drawSmallNotes() {
  for (let i = smallNotes.length - 1; i >= 0; i--) {
    let small = smallNotes[i];

    fill(
      small.color[0],
      small.color[1],
      small.color[2],
      small.alpha
    );

    noStroke();

    // 음표 머리
    ellipse(
      small.x,
      small.y,
      small.size,
      small.size * 0.74
    );

    // 음표 기둥
    rect(
      small.x + small.size * 0.3,
      small.y - small.size * 1.25,
      small.size * 0.22,
      small.size
    );

    // 음표 꼬리
    triangle(
      small.x + small.size * 0.52,
      small.y - small.size * 1.25,

      small.x + small.size * 0.95,
      small.y - small.size * 0.9,

      small.x + small.size * 0.52,
      small.y - small.size * 0.7
    );

    // ====================
    // 작은 음표 움직임
    // ====================

    small.y -= 0.8;

    small.size -= 0.15;

    small.alpha -= 4;

    // 완전히 사라지면 삭제
    if (
      small.alpha <= 0 ||
      small.size <= 5
    ) {
      smallNotes.splice(i, 1);
    }
  }
}


// ====================
// 기하학적 음표 그리기
// ====================

function drawNote(x, y) {
  fill(
    currentNoteColor[0],
    currentNoteColor[1],
    currentNoteColor[2],
    finalNoteAlpha
  );

  noStroke();

  // 음표 머리
  ellipse(
    x,
    y,
    42,
    31
  );

  // 음표 기둥
  rect(
    x + 13,
    y - 66,
    9,
    52
  );

  // 음표 꼬리
  triangle(
    x + 22,
    y - 66,

    x + 42,
    y - 50,

    x + 22,
    y - 38
  );
}


// ====================
// 건반 X 좌표 가져오기
// ====================

function getKeyX(index) {
  return width / 2 - 330 + index * 94;
}


// ====================
// 화면 크기 변경
// ====================

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}3
