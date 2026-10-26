const STORAGE_KEY = "memedicine-coffee-memos-v1";
const PASTEL_COLORS = [
  "#D9D2EF",
  "#F2B8C6",
  "#F7D98B",
  "#B8CFF0",
  "#D7C1EA",
  "#F4C7A1",
];
const IMPORTANCE_SIZES = { 1: 19, 2: 29, 3: 41 };
const IMPORTANCE_CREAM_COLORS = { 1: "#DCEBFA", 2: "#FADCE5", 3: "#FFF0C9" };
const CAKE_RIM_SLOT_COUNT = 16;
const MAX_CAKE_RIM_CREAMS = 32;
const CREAM_VISUAL_SCALE = 0.88;
// A forgiving touch target around frosting; this does not change its appearance.
const CREAM_HIT_AREA_SCALE = 1.28;
const CAKE_SLICE_SPAN_SCALE = 0.9;
// Interleave opposite sides first, then fill the gaps around the rim.
const CAKE_RIM_SLOT_ORDER = [
  0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15,
];
let memos = [];
let categories = ["Personal", "Study", "Work", "Life"];
let fallingCubes = [];
let selectedMemoId = null;
let draggingMemoId = null;
let potentialMemoDragId = null;
let memoDragStart = null;
let memoDragMoved = false;
let coffee = {};
let pipedCreams = [];
let activePipe = null;
let selectedCakeSlice = null;
let restoreMode = false;
let fireworks = [];
let celebrationState = "normal";
let queuedCelebrations = 0;
let cakeRotation = 0;
// p5 constants such as HALF_PI are only available after p5 initializes.
// Use the native value here so top-level initialization cannot throw.
let pipingBagAngle = -Math.PI / 2;
let cakeGesture = null;
let lastTouchAt = 0;
let lastPointerX = 0;
let lastPointerY = 0;
let activePointerId = null;
let creamDragPreview = null;
let hoveredCreamId = null;
let editingMemoId = null;
let storageReadFailed = false;
let storageWriteFailed = false;
let cakeCapacityMessage = "";
let currentInteractionHint = "";
let quickGuideStep = "create";
let quickGuideDismissed = false;
function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvasWrap");
  installCanvasPointerEvents(canvas.elt);
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  loadData();
  fallingCubes = [];
  restorePipedCreamsFromMemos();
  initializeQuickGuide();
  activePipe = null;
  calculateCoffeeLayout();
  setupUI();
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateCoffeeLayout();
  if (
    selectedCakeSlice &&
    document.getElementById("detailModal")?.classList.contains("sliceDetail")
  ) {
    positionDetailCardNearSlice(selectedCakeSlice.slot);
  }
  for (const memo of memos) {
    if (memo.archived || memo.completed || memo.settled || memo.cubeX == null)
      continue;
    memo.cubeX = constrain(
      memo.cubeX,
      coffee.centerX - coffee.creamWidth * 0.35,
      coffee.centerX + coffee.creamWidth * 0.35,
    );
  }
  for (const cube of fallingCubes) {
    cube.x = constrain(
      cube.x,
      coffee.centerX - coffee.creamWidth * 0.35,
      coffee.centerX + coffee.creamWidth * 0.35,
    );
  }
  saveData();
}
function draw() {
  background("#E4EADF");
  calculateCoffeeLayout();
  updateCakeSliceAnimation();
  drawCakeScene();
  if (celebrationState === "normal") drawPipingBag();
  updateAndDrawFireworks();
  updateFallingCubes();
  updateInteractionHint();
}
function updateInteractionHint() {
  const guide = document.getElementById("interactionHint");
  const hint = document.getElementById("interactionHintText");
  if (!guide || !hint) return;
  if (quickGuideDismissed) {
    guide.hidden = true;
    return;
  }
  const messages = {
    create: "1. Create a memo from the menu.",
    pipe: "2. Tap the piping bag to add cream.",
    complete: "3. In Browse, check the memo when it is done.",
    candle: "4. Tap the candle for fireworks.",
  };
  const message = messages[quickGuideStep] || messages.create;
  guide.hidden = false;
  if (message !== currentInteractionHint) {
    hint.textContent = message;
    currentInteractionHint = message;
  }
}
function initializeQuickGuide() {
  // Guide dismissal is temporary for this completed flow, not permanent across
  // page reloads. Restore a concise next-step hint from the saved memo state.
  quickGuideDismissed = false;
  quickGuideStep = "create";
  currentInteractionHint = "";
  if (
    memos.some(
      (memo) =>
        !memo.archived && !memo.completed && !memo.piped && !memo.settled,
    )
  ) {
    quickGuideStep = "pipe";
  } else if (
    memos.some((memo) => !memo.archived && !memo.completed && memo.piped)
  ) {
    quickGuideStep = "complete";
  }
}
function restartQuickGuide(step = "create") {
  quickGuideDismissed = false;
  quickGuideStep = step;
  currentInteractionHint = "";
  const guide = document.getElementById("interactionHint");
  if (guide) guide.hidden = false;
}
function setQuickGuideStep(step) {
  if (quickGuideDismissed) return;
  quickGuideStep = step;
  currentInteractionHint = "";
}
function hideQuickGuide() {
  quickGuideDismissed = true;
  const guide = document.getElementById("interactionHint");
  if (guide) guide.hidden = true;
}
function drawCakeScene() {
  const rotation = activeCakeRotation();
  const pivot = cakeRotationPivot();
  push();
  translate(pivot.x, pivot.y);
  rotate(rotation);
  translate(-pivot.x, -pivot.y);
  drawGroundShadow();
  drawSaucer();
  drawCup();
  const candleVisible = celebrationState !== "normal";
  updatePipedCreams();
  hoveredCreamId = null;
  const creamsToDraw = orderedPipedCreams();
  if (creamDragPreview) {
    creamsToDraw.sort((a, b) => {
      const aPlacement =
        a.memoId === creamDragPreview.memoId
          ? creamDragPreview
          : cakeCreamPlacement(a.slot, a.importance);
      const bPlacement =
        b.memoId === creamDragPreview.memoId
          ? creamDragPreview
          : cakeCreamPlacement(b.slot, b.importance);
      return (
        cakeToScreen(aPlacement.x, aPlacement.y).y -
        cakeToScreen(bPlacement.x, bPlacement.y).y
      );
    });
  }
  const lowerTopScreenY = cakeToScreen(coffee.centerX, coffee.cupTopY).y;
  const lowerBackCreams = [];
  const lowerFrontCreams = [];
  for (const cream of creamsToDraw) {
    const placement =
      creamDragPreview?.memoId === cream.memoId
        ? creamDragPreview
        : cakeCreamPlacement(cream.slot, cream.importance);
    const isMovingSlice = selectedCakeSlice?.memoId === cream.memoId;
    const depthY = cakeToScreen(placement.x, placement.y).y;
    if (depthY < lowerTopScreenY && !isMovingSlice) lowerBackCreams.push(cream);
    else lowerFrontCreams.push(cream);
  }
  if (selectedCakeSlice && selectedCakeSlice.progress > 0.001) {
    drawCakeSliceNotch(selectedCakeSlice.slot);
  }
  drawPipedCreamGroup(lowerBackCreams);
  // Draw the lifted wedge after the cake bodies so its cut faces stay visible.
  if (selectedCakeSlice && selectedCakeSlice.progress > 0.001)
    drawDetachedCakeSlice(selectedCakeSlice);
  drawPipedCreamGroup(lowerFrontCreams);
  if (candleVisible) drawCenterCandle();
  const candlePoint = screenToCake(mouseX, mouseY);
  const candleHovered =
    celebrationState === "candle" &&
    pointHitsCenterCandle(candlePoint.x, candlePoint.y);
  const pipingBagHovered =
    celebrationState === "normal" && pointHitsPipingBag(mouseX, mouseY);
  cursor(
    candleHovered
      ? "pointer"
      : cakeGesture?.moved
        ? "grabbing"
        : hoveredCreamId || pipingBagHovered
          ? "grab"
          : ARROW,
  );
  updateProgressInfo();
  pop();
}
function drawPipedCreamGroup(creams) {
  for (const cream of creams) {
    const creamMemo = memos.find((memo) => memo.id === cream.memoId);
    if (!creamMemo || creamMemo.archived) continue;
    const isHovered = pointHitsPipedCream(mouseX, mouseY, cream);
    if (
      isHovered &&
      !document.getElementById("detailModal").classList.contains("open")
    )
      hoveredCreamId = cream.memoId;
    const isAttachedToMovingSlice =
      selectedCakeSlice && cream.memoId === selectedCakeSlice.memoId;
    const isBeingDragged = creamDragPreview?.memoId === cream.memoId;
    const emphasis =
      cream.memoId === selectedMemoId || isHovered || isBeingDragged;
    let offset = { x: 0, y: 0 };
    if (isAttachedToMovingSlice) {
      offset = cakeSliceOffset(
        selectedCakeSlice.slot,
        selectedCakeSlice.progress,
      );
    }
    if (isBeingDragged) {
      const original = cakeCreamPlacement(cream.slot, cream.importance);
      offset.x += creamDragPreview.x - original.x;
      offset.y += creamDragPreview.y - original.y;
    }
    drawPipedCream(cream, offset.x, offset.y, emphasis);
  }
}
function screenToCake(x, y) {
  const pivot = cakeRotationPivot();
  const dx = x - pivot.x;
  const dy = y - pivot.y;
  const rotation = activeCakeRotation();
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    x: pivot.x + dx * cosine + dy * sine,
    y: pivot.y - dx * sine + dy * cosine,
  };
}
function cakeToScreen(x, y) {
  const pivot = cakeRotationPivot();
  const dx = x - pivot.x;
  const dy = y - pivot.y;
  const rotation = activeCakeRotation();
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    x: pivot.x + dx * cosine - dy * sine,
    y: pivot.y + dx * sine + dy * cosine,
  };
}
function cakeRotationPivot() {
  return {
    x: coffee.centerX || width * 0.5,
    y:
      (coffee.topCakeY + coffee.saucerY + coffee.saucerHeight * 0.5) / 2 ||
      height * 0.72,
  };
}
function pointInBounds(x, y, bounds) {
  return (
    x >= bounds.left &&
    x <= bounds.right &&
    y >= bounds.top &&
    y <= bounds.bottom
  );
}
function rotatedSurfaceX(centerX, offset, surfaceWidth) {
  const halfWidth = surfaceWidth * 0.5;
  const wrapped =
    ((((offset + halfWidth) % surfaceWidth) + surfaceWidth) % surfaceWidth) -
    halfWidth;
  return centerX + wrapped;
}
function setCakeRotation(nextRotation, persist = false) {
  // Cake rotation is intentionally disabled; retain the helper so existing
  // gesture code cannot apply a stale saved angle or rotate the scene.
  cakeRotation = 0;
}
function activeCakeRotation() {
  return 0;
}
function orderedPipedCreams() {
  return [...pipedCreams].sort((a, b) => {
    const aPlacement = cakeCreamPlacement(a.slot || 0, a.importance);
    const bPlacement = cakeCreamPlacement(b.slot || 0, b.importance);
    const aY = cakeToScreen(aPlacement.x, aPlacement.y).y;
    const bY = cakeToScreen(bPlacement.x, bPlacement.y).y;
    return aY - bY;
  });
}
function calculateCoffeeLayout() {
  const scale = Math.min(width / 1050, height / 850, 1.2);
  const cupWidth = Math.min(width * 0.53, 560 * scale);
  const cupHeight = cupWidth * 0.54;
  const centerX = width * 0.415;
  const creamHeight = Math.min(cupWidth * 0.62, height * 0.3);
  const topCakeY = Math.max(
    creamHeight + 70,
    Math.min(height * 0.63, height - cupHeight - 90),
  );
  const cupTopY = topCakeY;
  const cupBottomY = cupTopY + cupHeight;
  const saucerWidth = cupWidth * 1.3;
  const saucerHeight = cupWidth * 0.14;
  const saucerY = cupBottomY + 11;
  coffee = {
    scale,
    centerX,
    cupWidth,
    cupHeight,
    topCakeY,
    cupTopY,
    cupBottomY,
    creamWidth: cupWidth * 0.98,
    creamHeight,
    saucerWidth,
    saucerHeight,
    saucerY,
  };
}
function cakeGeometry() {
  return {
    centerX: coffee.centerX,
    width: coffee.cupWidth,
    topY: coffee.cupTopY,
    bottomY: coffee.cupBottomY,
    height: coffee.cupHeight,
    opacity: 1,
  };
}
function drawGroundShadow() {
  push();
  noStroke();
  fill(100, 75, 60, 14);
  ellipse(
    coffee.centerX,
    coffee.saucerY + coffee.saucerHeight * 0.15,
    coffee.saucerWidth * 1.08,
    coffee.saucerHeight * 0.78,
  );
  pop();
}
function drawSaucer() {
  const { centerX, saucerY, saucerWidth, saucerHeight } = coffee;
  push();
  noStroke();
  fill("#D8D1C8");
  ellipse(centerX, saucerY + 3, saucerWidth, saucerHeight);
  fill("#F1EEE8");
  ellipse(centerX, saucerY, saucerWidth, saucerHeight * 0.91);
  fill("#FFFEFB");
  ellipse(centerX, saucerY - 2, saucerWidth * 0.98, saucerHeight * 0.76);
  fill(255, 255, 255, 150);
  ellipse(
    centerX - saucerWidth * 0.14,
    saucerY - saucerHeight * 0.15,
    saucerWidth * 0.3,
    saucerHeight * 0.11,
  );
  pop();
}
function drawCup() {
  const { centerX, cupWidth, cupTopY, cupBottomY } = coffee;
  const h = cupBottomY - cupTopY;
  push();
  noStroke();
  const ctx = drawingContext;
  const cakeGradient = ctx.createLinearGradient(
    centerX - cupWidth * 0.5,
    0,
    centerX + cupWidth * 0.5,
    0,
  );
  cakeGradient.addColorStop(0, "#E9E7E0");
  cakeGradient.addColorStop(0.13, "#FAF9F4");
  cakeGradient.addColorStop(0.48, "#FFFDF8");
  cakeGradient.addColorStop(0.82, "#F7F5EF");
  cakeGradient.addColorStop(1, "#E4E1D9");
  ctx.fillStyle = cakeGradient;
  ctx.beginPath();
  ctx.moveTo(centerX - cupWidth * 0.49, cupTopY + 2);
  ctx.bezierCurveTo(
    centerX - cupWidth * 0.49,
    cupTopY + h * 0.48,
    centerX - cupWidth * 0.485,
    cupBottomY - cupWidth * 0.035,
    centerX - cupWidth * 0.46,
    cupBottomY - 2,
  );
  ctx.bezierCurveTo(
    centerX - cupWidth * 0.3,
    cupBottomY + 1,
    centerX + cupWidth * 0.3,
    cupBottomY + 1,
    centerX + cupWidth * 0.46,
    cupBottomY - 2,
  );
  ctx.bezierCurveTo(
    centerX + cupWidth * 0.485,
    cupBottomY - cupWidth * 0.035,
    centerX + cupWidth * 0.49,
    cupTopY + h * 0.48,
    centerX + cupWidth * 0.49,
    cupTopY + 2,
  );
  ctx.closePath();
  ctx.fill();
  const highlight = ctx.createLinearGradient(
    centerX - cupWidth * 0.43,
    0,
    centerX - cupWidth * 0.08,
    0,
  );
  highlight.addColorStop(0, "rgba(255,255,255,0)");
  highlight.addColorStop(0.45, "rgba(255,255,255,0.76)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.moveTo(centerX - cupWidth * 0.42, cupTopY + 10);
  ctx.bezierCurveTo(
    centerX - cupWidth * 0.4,
    cupTopY + h * 0.42,
    centerX - cupWidth * 0.34,
    cupBottomY - 8,
    centerX - cupWidth * 0.2,
    cupBottomY - 4,
  );
  ctx.bezierCurveTo(
    centerX - cupWidth * 0.3,
    cupBottomY - 24,
    centerX - cupWidth * 0.33,
    cupTopY + h * 0.32,
    centerX - cupWidth * 0.3,
    cupTopY + 10,
  );
  ctx.closePath();
  ctx.fill();
  noStroke();
  fill("#E6E2D9");
  ellipse(centerX, cupTopY + 3, cupWidth * 1.02, cupWidth * 0.19);
  fill("#FFFDF8");
  ellipse(centerX, cupTopY, cupWidth, cupWidth * 0.185);
  fill(255, 255, 255, 110);
  ellipse(
    centerX - cupWidth * 0.12,
    cupTopY - cupWidth * 0.018,
    cupWidth * 0.55,
    cupWidth * 0.105,
  );
  noFill();
  stroke(232, 225, 214, 72);
  strokeWeight(Math.max(1, cupWidth * 0.002));
  arc(
    centerX,
    cupTopY + cupWidth * 0.005,
    cupWidth * 0.72,
    cupWidth * 0.125,
    Math.PI * 1.08,
    Math.PI * 1.92,
  );
  stroke(215, 211, 203, 42);
  strokeWeight(Math.max(1, cupWidth * 0.0022));
  for (let i = -3; i <= 3; i++) {
    const x = rotatedSurfaceX(centerX, i * cupWidth * 0.105, cupWidth * 0.84);
    const bend = (i % 2 === 0 ? 1 : -1) * cupWidth * 0.012;
    bezier(
      x,
      cupTopY + h * 0.12,
      x + bend,
      cupTopY + h * 0.25,
      x - bend,
      cupTopY + h * 0.39,
      x,
      cupTopY + h * 0.47,
    );
    bezier(
      x,
      cupTopY + h * 0.57,
      x - bend,
      cupTopY + h * 0.69,
      x + bend,
      cupTopY + h * 0.83,
      x,
      cupBottomY - cupWidth * 0.045,
    );
  }
  ctx.beginPath();
  ctx.moveTo(centerX - cupWidth * 0.477, cupTopY + h * 0.505);
  ctx.bezierCurveTo(
    centerX - cupWidth * 0.25,
    cupTopY + h * 0.53,
    centerX + cupWidth * 0.25,
    cupTopY + h * 0.53,
    centerX + cupWidth * 0.477,
    cupTopY + h * 0.505,
  );
  ctx.lineTo(centerX + cupWidth * 0.477, cupTopY + h * 0.535);
  ctx.bezierCurveTo(
    centerX + cupWidth * 0.25,
    cupTopY + h * 0.56,
    centerX - cupWidth * 0.25,
    cupTopY + h * 0.56,
    centerX - cupWidth * 0.477,
    cupTopY + h * 0.535,
  );
  ctx.closePath();
  ctx.fillStyle = "rgba(235,218,198,0.8)";
  ctx.fill();
  noFill();
  stroke("#E9E3D9");
  strokeWeight(Math.max(1.2, cupWidth * 0.0045));
  beginShape();
  vertex(centerX - cupWidth * 0.477, cupTopY + h * 0.51);
  ctx.bezierCurveTo(
    centerX - cupWidth * 0.25,
    cupTopY + h * 0.535,
    centerX + cupWidth * 0.25,
    cupTopY + h * 0.535,
    centerX + cupWidth * 0.477,
    cupTopY + h * 0.51,
  );
  endShape();
  stroke("#FFFFFF");
  strokeWeight(Math.max(1, cupWidth * 0.0025));
  beginShape();
  vertex(centerX - cupWidth * 0.455, cupTopY + h * 0.51 - 2);
  ctx.bezierCurveTo(
    centerX - cupWidth * 0.22,
    cupTopY + h * 0.525 - 2,
    centerX + cupWidth * 0.22,
    cupTopY + h * 0.525 - 2,
    centerX + cupWidth * 0.455,
    cupTopY + h * 0.51 - 2,
  );
  endShape();
  pop();
}
function cakeSliceAngles(slot) {
  const normalizedSlot = positiveModulo(Math.floor(slot), MAX_CAKE_RIM_CREAMS);
  const isInterleavedSlot = normalizedSlot >= CAKE_RIM_SLOT_COUNT;
  const rimPosition = CAKE_RIM_SLOT_ORDER[normalizedSlot % CAKE_RIM_SLOT_COUNT];
  const count = isInterleavedSlot
    ? CAKE_RIM_SLOT_COUNT * 2
    : CAKE_RIM_SLOT_COUNT;
  const centerStep = isInterleavedSlot ? rimPosition + 1 : rimPosition + 0.5;
  const step = (TWO_PI / count) * CAKE_SLICE_SPAN_SCALE;
  const center = -HALF_PI + centerStep * (TWO_PI / CAKE_RIM_SLOT_COUNT);
  return { start: center - step * 0.5, end: center + step * 0.5, center };
}
function traceCakeSliceTop(ctx, slot) {
  const { start, end } = cakeSliceAngles(slot);
  const g = cakeGeometry();
  const { centerX, topY, width } = g;
  const outerX = width * 0.5;
  const outerY = width * 0.0925;
  ctx.moveTo(centerX, topY);
  ctx.lineTo(
    centerX + outerX * Math.cos(start),
    topY + outerY * Math.sin(start),
  );
  ctx.ellipse(centerX, topY, outerX, outerY, 0, start, end);
  ctx.closePath();
}
function cakeSliceOffset(slot, progress) {
  const { center } = cakeSliceAngles(slot);
  const distance = cakeGeometry().width * 0.1 * constrain(progress, 0, 1);
  // Every detached slice rises; its side still follows the selected rim angle.
  return {
    x: Math.cos(center) * distance * 0.45,
    y: -distance,
  };
}
function drawCupWithoutSlice(slot) {
  drawCup();
  drawCakeSliceNotch(slot);
}
function drawCakeSliceCutEdges(slot) {
  const { start, end } = cakeSliceAngles(slot);
  const g = cakeGeometry();
  const { centerX, topY, width } = g;
  const outerX = width * 0.5;
  const outerY = width * 0.0925;
  const ctx = drawingContext;
  ctx.save();
  ctx.lineCap = "round";
  for (const angle of [start, end]) {
    ctx.beginPath();
    ctx.moveTo(centerX, topY);
    ctx.lineTo(
      centerX + outerX * Math.cos(angle),
      topY + outerY * Math.sin(angle),
    );
    ctx.strokeStyle = "rgba(177,154,128,0.38)";
    ctx.lineWidth = Math.max(1.2, width * 0.004);
    ctx.stroke();
  }
  ctx.restore();
}
function drawCakeSliceNotch(slot) {
  const geometry = cakeGeometry();
  const ctx = drawingContext;
  ctx.save();
  ctx.beginPath();
  traceCakeSliceTop(ctx, slot);
  // Show the exposed cake interior in the removed slice area instead of
  // painting the page background through the cake.
  const filling = ctx.createLinearGradient(
    geometry.centerX - geometry.width * 0.5,
    geometry.topY,
    geometry.centerX + geometry.width * 0.5,
    geometry.topY + geometry.height * 0.2,
  );
  filling.addColorStop(0, "#C99A6D");
  filling.addColorStop(0.3, "#E2BD91");
  filling.addColorStop(0.68, "#C58F60");
  filling.addColorStop(1, "#A9744F");
  ctx.fillStyle = filling;
  ctx.fill();
  ctx.restore();
  drawCakeSliceCutEdges(slot);
}
function drawDetachedCakeSlice(slice) {
  const { start, end } = cakeSliceAngles(slice.slot);
  const offset = cakeSliceOffset(slice.slot, slice.progress);
  const g = cakeGeometry();
  const { centerX, topY, height, width } = g;
  const ctx = drawingContext;
  const outerX = width * 0.5;
  const outerY = width * 0.0925;
  const depth = height * 0.82;
  const centerTop = { x: centerX, y: topY };
  const centerBottom = { x: centerX, y: topY + depth };
  const point = (rx, ry, angle) => ({
    x: centerX + rx * Math.cos(angle),
    y: topY + ry * Math.sin(angle),
  });
  const outerStart = point(outerX, outerY, start);
  const outerEnd = point(outerX, outerY, end);
  const bottomY = topY + depth;
  push();
  translate(offset.x, offset.y);
  noStroke();
  const side = ctx.createLinearGradient(
    centerX - width * 0.5,
    0,
    centerX + width * 0.5,
    0,
  );
  side.addColorStop(0, "#E9E7E0");
  side.addColorStop(0.13, "#FAF9F4");
  side.addColorStop(0.48, "#FFFDF8");
  side.addColorStop(0.82, "#F7F5EF");
  side.addColorStop(1, "#E4E1D9");
  ctx.beginPath();
  ctx.ellipse(centerX, topY, outerX, outerY, 0, start, end);
  ctx.lineTo(outerEnd.x, outerEnd.y + depth);
  ctx.ellipse(centerX, topY + depth, outerX, outerY, 0, end, start, true);
  ctx.closePath();
  ctx.fillStyle = side;
  ctx.fill();
  for (const topOuter of [outerStart, outerEnd]) {
    ctx.beginPath();
    ctx.moveTo(centerTop.x, centerTop.y);
    ctx.lineTo(topOuter.x, topOuter.y);
    ctx.lineTo(topOuter.x, topOuter.y + depth);
    ctx.lineTo(centerBottom.x, centerBottom.y);
    ctx.closePath();
    const cutFace = ctx.createLinearGradient(
      centerX - width * 0.5,
      0,
      centerX + width * 0.5,
      0,
    );
    cutFace.addColorStop(0, "#E9E7E0");
    cutFace.addColorStop(0.13, "#FAF9F4");
    cutFace.addColorStop(0.48, "#FFFDF8");
    cutFace.addColorStop(0.82, "#F7F5EF");
    cutFace.addColorStop(1, "#E4E1D9");
    ctx.fillStyle = cutFace;
    ctx.fill();
    ctx.strokeStyle = "rgba(190,172,148,0.66)";
    ctx.lineWidth = Math.max(1.2, width * 0.003);
    ctx.stroke();
  }
  // Close the underside with an opaque sponge face so the lifted slice never
  // reads as a hollow shell or shows the page background through its base.
  ctx.beginPath();
  ctx.moveTo(centerBottom.x, bottomY);
  ctx.lineTo(outerStart.x, outerStart.y + depth);
  ctx.ellipse(centerX, bottomY, outerX, outerY, 0, start, end);
  ctx.closePath();
  const spongeBottom = ctx.createLinearGradient(
    centerX - width * 0.5,
    bottomY,
    centerX + width * 0.5,
    bottomY + outerY,
  );
  spongeBottom.addColorStop(0, "#A66D45");
  spongeBottom.addColorStop(0.24, "#D0A174");
  spongeBottom.addColorStop(0.58, "#BD8758");
  spongeBottom.addColorStop(1, "#98613F");
  ctx.fillStyle = spongeBottom;
  ctx.fill();
  ctx.strokeStyle = "rgba(126,79,49,0.72)";
  ctx.lineWidth = Math.max(1.2, width * 0.003);
  ctx.stroke();
  const icing = ctx.createLinearGradient(
    0,
    topY - width * 0.1,
    0,
    topY + width * 0.1,
  );
  icing.addColorStop(0, "#FFFFFF");
  icing.addColorStop(0.72, "#FFFDF8");
  icing.addColorStop(1, "#EEEAE2");
  ctx.beginPath();
  traceCakeSliceTop(ctx, slice.slot);
  ctx.fillStyle = icing;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(centerX, topY, outerX, outerY, 0, start, end);
  ctx.lineTo(centerTop.x, centerTop.y);
  ctx.closePath();
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = Math.max(1, width * 0.003);
  ctx.stroke();
  for (const angle of [start, end]) {
    const outer = point(outerX, outerY, angle);
    ctx.beginPath();
    ctx.moveTo(centerTop.x, centerTop.y);
    ctx.lineTo(outer.x, outer.y);
    ctx.strokeStyle = "rgba(190,172,148,0.72)";
    ctx.lineWidth = Math.max(1.3, width * 0.004);
    ctx.stroke();
  }
  pop();
}
function updateCakeSliceAnimation() {
  if (!selectedCakeSlice) return;
  if (selectedCakeSlice.closing) {
    selectedCakeSlice.progress *= 0.84;
    if (selectedCakeSlice.progress < 0.004) selectedCakeSlice = null;
  } else {
    selectedCakeSlice.progress += (1 - selectedCakeSlice.progress) * 0.16;
    if (selectedCakeSlice.progress > 0.995) selectedCakeSlice.progress = 1;
  }
}
function pipingBagGeometry() {
  const baseLength = coffee.cupWidth * 0.89;
  const baseWidth = coffee.cupWidth * 0.285;
  const rimRadiusX = coffee.cupWidth * 0.5;
  const rimRadiusY = coffee.cupWidth * 0.0925;
  const tipX = coffee.centerX + rimRadiusX * Math.cos(pipingBagAngle);
  const tipY = coffee.cupTopY + rimRadiusY * Math.sin(pipingBagAngle);
  const normalX = Math.cos(pipingBagAngle) / rimRadiusX;
  const normalY = Math.sin(pipingBagAngle) / rimRadiusY;
  const angle = Math.atan2(normalY, normalX);
  const screenTip = cakeToScreen(tipX, tipY);
  const screenAngle = angle + activeCakeRotation();
  const cosine = Math.cos(screenAngle);
  const sine = Math.sin(screenAngle);
  const localX = [-baseLength * 0.06, baseLength * 1.0];
  const localY = [-baseWidth * 0.52, baseWidth * 0.52];
  const corners = localX.flatMap((x) =>
    localY.map((y) => ({
      x: x * cosine - y * sine,
      y: x * sine + y * cosine,
    })),
  );
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  const edgePadding = Math.max(10, coffee.scale * 8);
  const fitRatios = [
    maxX > 0 ? (width - edgePadding - screenTip.x) / maxX : 1,
    minX < 0 ? (screenTip.x - edgePadding) / -minX : 1,
    maxY > 0 ? (height - edgePadding - screenTip.y) / maxY : 1,
    minY < 0 ? (screenTip.y - edgePadding) / -minY : 1,
  ];
  // Keep the whole bag visible as it moves around the rim. At the top edge,
  // for example, it smoothly scales down instead of being clipped by canvas.
  const fitScale = constrain(Math.min(1, ...fitRatios) * 0.96, 0.28, 1);
  const length = baseLength * fitScale;
  return {
    tipX,
    tipY,
    angle,
    length,
    width: baseWidth * fitScale,
    fitScale,
  };
}
function drawPipingBag() {
  const g = pipingBagGeometry();
  const ctx = drawingContext;
  const bodyStart = g.length * 0.18;
  const bodyEnd = g.length * 0.94;
  const tailX = g.length * 0.98;
  const bagWidth = g.width;
  const screenTip = cakeToScreen(g.tipX, g.tipY);
  ctx.save();
  ctx.translate(screenTip.x, screenTip.y);
  ctx.rotate(g.angle + activeCakeRotation());
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Draw with the native canvas context throughout. Mixing p5 beginShape()
  // with a directly assigned CanvasGradient can inherit p5's noFill state.
  const nozzleGradient = ctx.createLinearGradient(
    0,
    -bagWidth * 0.09,
    0,
    bagWidth * 0.09,
  );
  nozzleGradient.addColorStop(0, "#59636A");
  nozzleGradient.addColorStop(0.24, "#879198");
  nozzleGradient.addColorStop(0.48, "#434D53");
  nozzleGradient.addColorStop(0.72, "#AEB7BC");
  nozzleGradient.addColorStop(1, "#515B62");
  ctx.fillStyle = nozzleGradient;
  ctx.beginPath();
  ctx.moveTo(-g.length * 0.045, -bagWidth * 0.028);
  ctx.lineTo(bodyStart, -bagWidth * 0.105);
  ctx.lineTo(bodyStart + g.length * 0.035, -bagWidth * 0.085);
  ctx.lineTo(bodyStart + g.length * 0.035, bagWidth * 0.085);
  ctx.lineTo(bodyStart, bagWidth * 0.105);
  ctx.lineTo(-g.length * 0.045, bagWidth * 0.028);
  ctx.closePath();
  ctx.fill();

  const bagGradient = ctx.createLinearGradient(bodyStart, 0, bodyEnd, 0);
  bagGradient.addColorStop(0, "#9EA8AE");
  bagGradient.addColorStop(0.12, "#E6EAEC");
  bagGradient.addColorStop(0.3, "#C7CED2");
  bagGradient.addColorStop(0.48, "#F7F9FA");
  bagGradient.addColorStop(0.68, "#D6DCE0");
  bagGradient.addColorStop(0.84, "#EEF1F2");
  bagGradient.addColorStop(1, "#AAB4BA");
  ctx.fillStyle = bagGradient;
  ctx.beginPath();
  ctx.moveTo(bodyStart, -bagWidth * 0.105);
  ctx.bezierCurveTo(
    bodyStart + g.length * 0.06,
    -bagWidth * 0.2,
    bodyStart + g.length * 0.22,
    -bagWidth * 0.48,
    bodyStart + g.length * 0.48,
    -bagWidth * 0.49,
  );
  ctx.bezierCurveTo(
    bodyStart + g.length * 0.65,
    -bagWidth * 0.5,
    bodyEnd - g.length * 0.045,
    -bagWidth * 0.39,
    bodyEnd,
    -bagWidth * 0.27,
  );
  ctx.lineTo(tailX, -bagWidth * 0.16);
  ctx.lineTo(tailX, bagWidth * 0.16);
  ctx.lineTo(bodyEnd, bagWidth * 0.27);
  ctx.bezierCurveTo(
    bodyEnd - g.length * 0.045,
    bagWidth * 0.39,
    bodyStart + g.length * 0.65,
    bagWidth * 0.5,
    bodyStart + g.length * 0.48,
    bagWidth * 0.49,
  );
  ctx.bezierCurveTo(
    bodyStart + g.length * 0.22,
    bagWidth * 0.48,
    bodyStart + g.length * 0.06,
    bagWidth * 0.2,
    bodyStart,
    bagWidth * 0.105,
  );
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(91,102,109,0.38)";
  ctx.lineWidth = Math.max(1.2, coffee.scale * 1.7);
  ctx.moveTo(bodyStart + g.length * 0.04, bagWidth * 0.075);
  ctx.bezierCurveTo(
    bodyStart + g.length * 0.15,
    bagWidth * 0.25,
    bodyStart + g.length * 0.35,
    bagWidth * 0.4,
    bodyStart + g.length * 0.55,
    bagWidth * 0.39,
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = Math.max(2, coffee.scale * 3.5);
  ctx.moveTo(bodyStart + g.length * 0.08, -bagWidth * 0.06);
  ctx.bezierCurveTo(
    bodyStart + g.length * 0.22,
    -bagWidth * 0.24,
    bodyStart + g.length * 0.49,
    -bagWidth * 0.36,
    bodyStart + g.length * 0.68,
    -bagWidth * 0.32,
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.49)";
  ctx.lineWidth = Math.max(1, coffee.scale * 1.5);
  ctx.moveTo(bodyStart + g.length * 0.15, bagWidth * 0.015);
  ctx.bezierCurveTo(
    bodyStart + g.length * 0.3,
    -bagWidth * 0.07,
    bodyStart + g.length * 0.52,
    -bagWidth * 0.19,
    bodyStart + g.length * 0.67,
    -bagWidth * 0.17,
  );
  ctx.stroke();

  const collarGradient = ctx.createLinearGradient(
    bodyStart - g.length * 0.018,
    0,
    bodyStart + g.length * 0.035,
    0,
  );
  collarGradient.addColorStop(0, "#626D73");
  collarGradient.addColorStop(0.38, "#DDE2E5");
  collarGradient.addColorStop(0.7, "#858F95");
  collarGradient.addColorStop(1, "#505B61");
  ctx.fillStyle = collarGradient;
  ctx.beginPath();
  ctx.moveTo(bodyStart - g.length * 0.018, -bagWidth * 0.12);
  ctx.lineTo(bodyStart + g.length * 0.035, -bagWidth * 0.13);
  ctx.lineTo(bodyStart + g.length * 0.035, bagWidth * 0.13);
  ctx.lineTo(bodyStart - g.length * 0.018, bagWidth * 0.12);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(105,116,123,0.69)";
  ctx.lineWidth = Math.max(1, coffee.scale * 1.35);
  for (let i = 0; i < 5; i++) {
    const x = bodyEnd + g.length * (0.005 + i * 0.008);
    ctx.moveTo(x, -bagWidth * 0.23);
    ctx.lineTo(x, bagWidth * 0.23);
  }
  ctx.stroke();

  ctx.fillStyle = "#3F494F";
  ctx.beginPath();
  ctx.ellipse(
    -g.length * 0.032,
    0,
    g.length * 0.0175,
    bagWidth * 0.031,
    0,
    0,
    TWO_PI,
  );
  ctx.fill();
  ctx.beginPath();
  ctx.strokeStyle = "rgba(190,198,203,0.9)";
  ctx.lineWidth = Math.max(1.2, coffee.scale * 1.6);
  ctx.ellipse(
    -g.length * 0.032,
    0,
    g.length * 0.0175,
    bagWidth * 0.031,
    0,
    -HALF_PI,
    HALF_PI,
  );
  ctx.stroke();
  ctx.restore();
}
function updatePipedCreams() {
  for (const cream of pipedCreams) {
    if (!cream.complete) {
      cream.progress = Math.min(1, cream.progress + 0.012);
      if (cream.progress >= 1) {
        cream.complete = true;
        const memo = memos.find((m) => m.id === cream.memoId);
        if (memo) {
          memo.piped = true;
          memo.creamColor = cream.color;
          memo.creamSeed = cream.seed;
          setQuickGuideStep("complete");
          saveData();
          renderMemoList();
        }
      }
    }
  }
}
function tracePipedCreamMound(ctx, creamWidth, creamHeight) {
  ctx.beginPath();
  ctx.moveTo(-creamWidth * 0.48, creamHeight * 0.22);
  ctx.bezierCurveTo(
    -creamWidth * 0.56,
    creamHeight * 0.06,
    -creamWidth * 0.48,
    -creamHeight * 0.24,
    -creamWidth * 0.27,
    -creamHeight * 0.35,
  );
  ctx.bezierCurveTo(
    -creamWidth * 0.14,
    -creamHeight * 0.42,
    -creamWidth * 0.07,
    -creamHeight * 0.46,
    creamWidth * 0.02,
    -creamHeight * 0.66,
  );
  ctx.bezierCurveTo(
    creamWidth * 0.09,
    -creamHeight * 0.49,
    creamWidth * 0.17,
    -creamHeight * 0.43,
    creamWidth * 0.29,
    -creamHeight * 0.36,
  );
  ctx.bezierCurveTo(
    creamWidth * 0.5,
    -creamHeight * 0.23,
    creamWidth * 0.55,
    creamHeight * 0.05,
    creamWidth * 0.47,
    creamHeight * 0.22,
  );
  ctx.bezierCurveTo(
    creamWidth * 0.36,
    creamHeight * 0.39,
    creamWidth * 0.16,
    creamHeight * 0.41,
    0,
    creamHeight * 0.36,
  );
  ctx.bezierCurveTo(
    -creamWidth * 0.22,
    creamHeight * 0.41,
    -creamWidth * 0.42,
    creamHeight * 0.37,
    -creamWidth * 0.48,
    creamHeight * 0.22,
  );
  ctx.closePath();
}
function drawPipedCreamRidges(ctx, creamWidth, creamHeight, deepColor) {
  ctx.shadowBlur = 0;
  for (let i = 0; i < 7; i++) {
    const t = (i - 3) / 3;
    const baseX = t * creamWidth * 0.42;
    const middleX = t * creamWidth * 0.29 + creamWidth * 0.025;
    const upperX = t * creamWidth * 0.15 + creamWidth * 0.025;
    ctx.beginPath();
    ctx.moveTo(baseX, creamHeight * 0.23);
    ctx.bezierCurveTo(
      baseX * 0.94,
      creamHeight * 0.04,
      middleX,
      -creamHeight * 0.17,
      upperX,
      -creamHeight * 0.39,
    );
    ctx.strokeStyle = hexToRgba(deepColor, 0.32);
    ctx.lineWidth = Math.max(1.2, creamWidth * 0.027);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(baseX - creamWidth * 0.018, creamHeight * 0.2);
    ctx.bezierCurveTo(
      baseX * 0.92 - creamWidth * 0.018,
      creamHeight * 0.015,
      middleX - creamWidth * 0.018,
      -creamHeight * 0.19,
      upperX - creamWidth * 0.018,
      -creamHeight * 0.39,
    );
    ctx.strokeStyle = "rgba(255,250,239,0.34)";
    ctx.lineWidth = Math.max(0.75, creamWidth * 0.012);
    ctx.stroke();
  }

  // A small curled tip makes the ridges read as one piped swirl.
  ctx.beginPath();
  ctx.moveTo(creamWidth * 0.018, -creamHeight * 0.64);
  ctx.bezierCurveTo(
    creamWidth * 0.12,
    -creamHeight * 0.57,
    creamWidth * 0.17,
    -creamHeight * 0.49,
    creamWidth * 0.11,
    -creamHeight * 0.45,
  );
  ctx.bezierCurveTo(
    creamWidth * 0.075,
    -creamHeight * 0.425,
    creamWidth * 0.045,
    -creamHeight * 0.46,
    creamWidth * 0.075,
    -creamHeight * 0.48,
  );
  ctx.strokeStyle = "rgba(255,250,239,0.48)";
  ctx.lineWidth = Math.max(0.8, creamWidth * 0.014);
  ctx.stroke();
}
function drawPipedCream(cream, offsetX = 0, offsetY = 0, emphasis = false) {
  const slot = positiveModulo(Number(cream.slot) || 0, MAX_CAKE_RIM_CREAMS);
  const surfaceGeometry = cakeGeometry();
  const progress = constrain(cream.progress, 0, 1);
  const importance = Math.round(constrain(Number(cream.importance) || 2, 1, 3));
  const placement = cakeCreamPlacement(slot, importance);
  const widths = [0, 0.09, 0.125, 0.16];
  const heights = [0, 0.085, 0.12, 0.17];
  const grow = constrain(progress * 4, 0, 1);
  const densityScale = creamDensityScale();
  const emphasisScale = emphasis ? 1.09 : 1;
  const creamWidth =
    surfaceGeometry.width *
    widths[importance] *
    CREAM_VISUAL_SCALE *
    grow *
    densityScale *
    emphasisScale;
  const creamHeight =
    surfaceGeometry.width *
    heights[importance] *
    CREAM_VISUAL_SCALE *
    grow *
    densityScale *
    emphasisScale;
  const creamColor =
    IMPORTANCE_CREAM_COLORS[importance] || IMPORTANCE_CREAM_COLORS[2];
  if (progress <= 0 || creamWidth <= 0 || creamHeight <= 0) return;
  push();
  translate(placement.x + offsetX, placement.y + offsetY);
  rotate(-activeCakeRotation());
  const ctx = drawingContext;
  ctx.save();
  ctx.globalAlpha *= surfaceGeometry.opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = emphasis
    ? "rgba(104, 78, 67, 0.30)"
    : "rgba(104, 78, 67, 0.14)";
  ctx.shadowBlur = Math.max(
    5,
    surfaceGeometry.width * (emphasis ? 0.02 : 0.012),
  );
  ctx.shadowOffsetY = Math.max(2, surfaceGeometry.width * 0.004);
  const lightColor = shadeHex(creamColor, 35);
  const deepColor = shadeHex(creamColor, -20);
  ctx.beginPath();
  ctx.ellipse(
    0,
    creamHeight * 0.14,
    creamWidth * 0.59,
    creamHeight * 0.31,
    0,
    0,
    TWO_PI,
  );
  const base = ctx.createLinearGradient(
    0,
    -creamHeight * 0.12,
    0,
    creamHeight * 0.48,
  );
  base.addColorStop(0, hexToRgba(lightColor, 0.64));
  base.addColorStop(0.48, hexToRgba(creamColor, 0.82));
  base.addColorStop(1, hexToRgba(deepColor, 0.68));
  ctx.fillStyle = base;
  ctx.fill();
  const mound = ctx.createRadialGradient(
    -creamWidth * 0.18,
    -creamHeight * 0.3,
    creamHeight * 0.025,
    creamWidth * 0.04,
    -creamHeight * 0.02,
    creamWidth * 0.64,
  );
  mound.addColorStop(0, "rgba(255,255,255,0.94)");
  mound.addColorStop(0.16, hexToRgba(lightColor, 0.82));
  mound.addColorStop(0.52, hexToRgba(creamColor, 0.76));
  mound.addColorStop(0.82, hexToRgba(deepColor, 0.62));
  mound.addColorStop(1, hexToRgba(deepColor, 0.48));
  ctx.beginPath();
  tracePipedCreamMound(ctx, creamWidth, creamHeight);
  ctx.fillStyle = mound;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  tracePipedCreamMound(ctx, creamWidth, creamHeight);
  ctx.clip();
  const glaze = ctx.createRadialGradient(
    -creamWidth * 0.2,
    -creamHeight * 0.34,
    creamHeight * 0.01,
    -creamWidth * 0.08,
    -creamHeight * 0.2,
    creamWidth * 0.52,
  );
  glaze.addColorStop(0, "rgba(255,255,255,0.78)");
  glaze.addColorStop(0.34, "rgba(255,255,255,0.28)");
  glaze.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glaze;
  ctx.fillRect(
    -creamWidth * 0.58,
    -creamHeight * 0.52,
    creamWidth * 1.16,
    creamHeight,
  );
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  tracePipedCreamMound(ctx, creamWidth, creamHeight);
  ctx.clip();
  drawPipedCreamRidges(ctx, creamWidth, creamHeight, deepColor);
  const specular = ctx.createRadialGradient(
    -creamWidth * 0.2,
    -creamHeight * 0.34,
    0,
    -creamWidth * 0.2,
    -creamHeight * 0.34,
    creamWidth * 0.14,
  );
  specular.addColorStop(0, "rgba(255,255,255,0.78)");
  specular.addColorStop(0.45, "rgba(255,255,255,0.3)");
  specular.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = specular;
  ctx.beginPath();
  ctx.ellipse(
    -creamWidth * 0.2,
    -creamHeight * 0.34,
    creamWidth * 0.14,
    creamHeight * 0.18,
    -0.35,
    0,
    TWO_PI,
  );
  ctx.fill();
  ctx.restore();
  if (cream.memoId === selectedMemoId) {
    noFill();
    stroke(255, 255, 255, 225);
    strokeWeight(Math.max(2, surfaceGeometry.width * 0.004));
    ellipse(0, -creamHeight * 0.13, creamWidth * 1.2, creamHeight * 1.5);
  }
  ctx.restore();
  pop();
}
function creamDensityScale() {
  const count = pipedCreams.filter((cream) =>
    memos.some((memo) => memo.id === cream.memoId && !memo.archived),
  ).length;
  return count > 24 ? 0.36 : count > 16 ? 0.48 : count > 12 ? 0.68 : 1;
}
function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}
function cakeCreamPlacement(slot, importance = 2) {
  return cakeCreamPlacementAtAngle(cakeCreamAngleForSlot(slot), importance);
}
function cakeCreamAngleForSlot(slot) {
  const normalizedSlot = positiveModulo(Math.floor(slot), MAX_CAKE_RIM_CREAMS);
  const baseSlot = normalizedSlot % CAKE_RIM_SLOT_COUNT;
  const rimPosition = CAKE_RIM_SLOT_ORDER[baseSlot];
  const extraHalfStep = normalizedSlot >= CAKE_RIM_SLOT_COUNT ? 0.5 : 0;
  return (
    -HALF_PI +
    ((rimPosition + 0.5 + extraHalfStep) * TWO_PI) / CAKE_RIM_SLOT_COUNT
  );
}
function cakeCreamPlacementAtAngle(angle, importance = 2) {
  const geometry = cakeGeometry();
  const creamSize = Math.round(constrain(Number(importance) || 2, 1, 3));
  const widths = [0, 0.09, 0.125, 0.16];
  const heights = [0, 0.085, 0.12, 0.17];
  const densityScale = creamDensityScale();
  const creamWidth =
    geometry.width *
    widths[creamSize] *
    CREAM_VISUAL_SCALE *
    1.1 *
    densityScale;
  const creamHeight =
    geometry.width *
    heights[creamSize] *
    CREAM_VISUAL_SCALE *
    1.1 *
    densityScale;
  const rimRadiusX = geometry.width * 0.5;
  const rimRadiusY = geometry.width * 0.0925;
  const edgeX = rimRadiusX * Math.cos(angle);
  const edgeY = rimRadiusY * Math.sin(angle);
  const normalX = Math.cos(angle) / rimRadiusX;
  const normalY = Math.sin(angle) / rimRadiusY;
  const normalLength = Math.hypot(normalX, normalY);
  const nx = normalX / normalLength;
  const ny = normalY / normalLength;
  const rotation = activeCakeRotation();
  const screenRightX = Math.cos(rotation);
  const screenRightY = -Math.sin(rotation);
  const screenDownX = Math.sin(rotation);
  const screenDownY = Math.cos(rotation);
  const baseRadiusX = creamWidth * 0.59;
  const baseRadiusY = creamHeight * 0.31;
  const supportX = baseRadiusX * (nx * screenRightX + ny * screenRightY);
  const supportY = baseRadiusY * (nx * screenDownX + ny * screenDownY);
  const support = Math.hypot(supportX, supportY);
  const inset = geometry.width * 0.004;
  const baseCenterOffsetX = creamHeight * 0.14 * screenDownX;
  const baseCenterOffsetY = creamHeight * 0.14 * screenDownY;
  return {
    x: geometry.centerX + edgeX - nx * (support + inset) - baseCenterOffsetX,
    y: geometry.topY + edgeY - ny * (support + inset) - baseCenterOffsetY,
    tangent: Math.atan2(
      rimRadiusY * Math.cos(angle),
      -rimRadiusX * Math.sin(angle),
    ),
  };
}
function centerCandleGeometry() {
  const cake = cakeGeometry();
  const candleWidth = Math.max(17, cake.width * 0.066);
  const candleHeight = Math.max(68, cake.width * 0.35);
  return {
    x: cake.centerX,
    bottomY: cake.topY,
    topY: cake.topY - candleHeight,
    width: candleWidth,
    height: candleHeight,
  };
}
function drawCenterCandle() {
  const candle = centerCandleGeometry();
  const left = candle.x - candle.width / 2;
  const right = candle.x + candle.width / 2;
  const radius = candle.width * 0.28;
  const ctx = drawingContext;
  push();
  noStroke();
  fill("#F5D5D8");
  rectMode(CORNERS);
  rect(
    candle.x - candle.width / 2,
    candle.topY,
    candle.x + candle.width / 2,
    candle.bottomY,
    candle.width * 0.28,
  );
  // Add soft diagonal color blocks, clipped to the candle body. The palette
  // keeps pink as the anchor and avoids green against the page background.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left + radius, candle.topY);
  ctx.lineTo(right - radius, candle.topY);
  ctx.quadraticCurveTo(right, candle.topY, right, candle.topY + radius);
  ctx.lineTo(right, candle.bottomY - radius);
  ctx.quadraticCurveTo(right, candle.bottomY, right - radius, candle.bottomY);
  ctx.lineTo(left + radius, candle.bottomY);
  ctx.quadraticCurveTo(left, candle.bottomY, left, candle.bottomY - radius);
  ctx.lineTo(left, candle.topY + radius);
  ctx.quadraticCurveTo(left, candle.topY, left + radius, candle.topY);
  ctx.closePath();
  ctx.clip();
  const candleStripeColors = [
    "#F2B8C6",
    "#F7D98B",
    "#D9D2EF",
    "#B8CFF0",
    "#F5D5D8",
  ];
  let bandIndex = 0;
  for (
    let bandY = candle.topY - candle.width;
    bandY < candle.bottomY + candle.width;
    bandY += candle.width * 0.92
  ) {
    ctx.beginPath();
    ctx.moveTo(left - 2, bandY + candle.width * 0.46);
    ctx.lineTo(right + 2, bandY - candle.width * 0.46);
    ctx.lineTo(right + 2, bandY + candle.width * 0.18);
    ctx.lineTo(left - 2, bandY + candle.width * 1.1);
    ctx.closePath();
    ctx.fillStyle = candleStripeColors[bandIndex % candleStripeColors.length];
    ctx.fill();
    bandIndex += 1;
  }
  ctx.restore();
  stroke("rgba(255,255,255,0.82)");
  strokeWeight(Math.max(1.8, candle.width * 0.1));
  line(
    candle.x - candle.width * 0.2,
    candle.topY + candle.height * 0.08,
    candle.x - candle.width * 0.2,
    candle.bottomY - candle.height * 0.08,
  );
  noStroke();
  stroke("#75635B");
  strokeWeight(Math.max(1.4, candle.width * 0.08));
  line(candle.x, candle.topY + 1, candle.x, candle.topY - candle.width * 0.2);
  const flameTopY = candle.topY - candle.width * 1.82;
  const flameBottomY = candle.topY - candle.width * 0.12;
  const flameHalfWidth = candle.width * 0.52;
  noStroke();
  fill("#F4B965");
  ctx.beginPath();
  ctx.moveTo(candle.x, flameTopY);
  ctx.bezierCurveTo(
    candle.x - flameHalfWidth * 0.12,
    flameTopY + candle.width * 0.58,
    candle.x - flameHalfWidth * 1.06,
    flameBottomY - candle.width * 0.24,
    candle.x,
    flameBottomY,
  );
  ctx.bezierCurveTo(
    candle.x + flameHalfWidth * 1.06,
    flameBottomY - candle.width * 0.24,
    candle.x + flameHalfWidth * 0.12,
    flameTopY + candle.width * 0.58,
    candle.x,
    flameTopY,
  );
  ctx.closePath();
  ctx.fill();
  fill("#FFF1C7");
  ctx.beginPath();
  ctx.moveTo(candle.x, flameTopY + candle.width * 0.42);
  ctx.bezierCurveTo(
    candle.x - flameHalfWidth * 0.08,
    flameTopY + candle.width * 0.84,
    candle.x - flameHalfWidth * 0.58,
    flameBottomY - candle.width * 0.12,
    candle.x,
    flameBottomY - candle.width * 0.04,
  );
  ctx.bezierCurveTo(
    candle.x + flameHalfWidth * 0.58,
    flameBottomY - candle.width * 0.12,
    candle.x + flameHalfWidth * 0.08,
    flameTopY + candle.width * 0.84,
    candle.x,
    flameTopY + candle.width * 0.42,
  );
  ctx.closePath();
  ctx.fill();
  pop();
}
function pointHitsCenterCandle(x, y) {
  if (celebrationState !== "candle") return false;
  const candle = centerCandleGeometry();
  return (
    x >= candle.x - candle.width * 1.5 &&
    x <= candle.x + candle.width * 1.5 &&
    y >= candle.topY - candle.width * 2.4 &&
    y <= candle.bottomY + 12
  );
}
function requestCompletionCelebration() {
  setQuickGuideStep("candle");
  if (celebrationState === "normal") celebrationState = "candle";
  else queuedCelebrations += 1;
}
function startFireworks() {
  if (celebrationState !== "candle" || fireworks.length > 0) return;
  hideQuickGuide();
  celebrationState = "fireworks";
  const palette = ["#F4B8C7", "#F7D98B", "#D9D2EF", "#B8CFF0", "#D7C1EA"];
  const candle = centerCandleGeometry();
  const tierWidth = cakeGeometry().width;
  const bursts = [
    { x: candle.x, y: candle.topY - tierWidth * 0.18 },
    { x: candle.x - tierWidth * 0.18, y: candle.topY - tierWidth * 0.33 },
    { x: candle.x + tierWidth * 0.18, y: candle.topY - tierWidth * 0.28 },
  ];
  for (const localBurst of bursts) {
    const burst = cakeToScreen(localBurst.x, localBurst.y);
    const burstColor = random(palette);
    for (let i = 0; i < 32; i++) {
      const angle = (TWO_PI * i) / 32 + random(-0.08, 0.08);
      const speed = random(1.8, 3.8);
      fireworks.push({
        x: burst.x,
        y: burst.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: burstColor,
        life: random(240, 300),
        maxLife: 300,
        size: random(4.5, 7.5),
      });
    }
  }
}
function updateAndDrawFireworks() {
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const particle = fireworks[i];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.018;
    particle.vx *= 0.984;
    particle.vy *= 0.984;
    particle.life -= 1;
    if (particle.life <= 0) {
      fireworks.splice(i, 1);
      continue;
    }
    const alpha = map(particle.life, 0, particle.maxLife, 0, 235, true);
    const glowColor = color(particle.color);
    glowColor.setAlpha(alpha * 0.24);
    noStroke();
    fill(glowColor);
    ellipse(particle.x, particle.y, particle.size * 2.8, particle.size * 2.8);
    const particleColor = color(particle.color);
    particleColor.setAlpha(alpha);
    fill(particleColor);
    ellipse(particle.x, particle.y, particle.size, particle.size);
  }
  if (celebrationState === "fireworks" && fireworks.length === 0) {
    if (queuedCelebrations > 0) {
      queuedCelebrations -= 1;
      celebrationState = "candle";
    } else celebrationState = "normal";
  }
}
function pointHitsPipedCream(x, y, cream) {
  const importance = Math.round(constrain(Number(cream.importance) || 2, 1, 3));
  const widths = [0, 0.09, 0.125, 0.16];
  const heights = [0, 0.085, 0.12, 0.17];
  const progress = constrain(Number(cream.progress) || 0, 0, 1);
  const grow = constrain(progress * 4, 0, 1);
  const geometry = cakeGeometry();
  const creamWidth =
    geometry.width *
    widths[importance] *
    CREAM_VISUAL_SCALE *
    creamDensityScale() *
    CREAM_HIT_AREA_SCALE *
    grow;
  const creamHeight =
    geometry.width *
    heights[importance] *
    CREAM_VISUAL_SCALE *
    creamDensityScale() *
    CREAM_HIT_AREA_SCALE *
    grow;
  if (creamWidth <= 0 || creamHeight <= 0) return false;

  const placement = cakeCreamPlacement(cream.slot, importance);
  const center = cakeToScreen(placement.x, placement.y);
  // The actual piped shape includes a wide base and a taller piped peak.
  // Keep the hit area around the full visible cream, including its highlight.
  const normalizedX = (x - center.x) / (creamWidth * 0.64);
  const normalizedY =
    (y - (center.y - creamHeight * 0.095)) / (creamHeight * 0.56);
  return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
}
function updateCreamDragPreview(gesture, pointerX, pointerY) {
  const cream = pipedCreams.find(
    (item) => item.memoId === gesture.target?.memoId,
  );
  if (!cream) return;
  const geometry = cakeGeometry();
  const local = screenToCake(pointerX, pointerY);
  const rimRadiusX = geometry.width * 0.5;
  const rimRadiusY = geometry.width * 0.0925;
  const normalizedX = (local.x - geometry.centerX) / rimRadiusX;
  const normalizedY = (local.y - geometry.topY) / rimRadiusY;
  const original = cakeCreamPlacement(cream.slot, cream.importance);
  const angle =
    Math.hypot(normalizedX, normalizedY) < 0.001
      ? Math.atan2(
          (original.y - geometry.topY) / rimRadiusY,
          (original.x - geometry.centerX) / rimRadiusX,
        )
      : Math.atan2(normalizedY, normalizedX);
  const dragPosition = cakeCreamPlacementAtAngle(angle, cream.importance);
  creamDragPreview = {
    memoId: cream.memoId,
    x: dragPosition.x,
    y: dragPosition.y,
  };
}
function commitCreamDrag(gesture) {
  const preview = creamDragPreview;
  const cream = pipedCreams.find(
    (item) => item.memoId === gesture.target?.memoId,
  );
  creamDragPreview = null;
  if (!preview || !cream) return;
  let destinationSlot = 0;
  let shortestDistance = Infinity;
  for (let slot = 0; slot < MAX_CAKE_RIM_CREAMS; slot++) {
    const placement = cakeCreamPlacement(slot, cream.importance);
    const distance =
      (placement.x - preview.x) ** 2 + (placement.y - preview.y) ** 2;
    if (distance < shortestDistance) {
      shortestDistance = distance;
      destinationSlot = slot;
    }
  }
  const previousSlot = Number(cream.slot) || 0;
  const occupyingCream = pipedCreams.find(
    (item) =>
      item.memoId !== cream.memoId && Number(item.slot) === destinationSlot,
  );
  if (occupyingCream) {
    occupyingCream.slot = previousSlot;
    const otherMemo = memos.find((item) => item.id === occupyingCream.memoId);
    if (otherMemo) otherMemo.creamSlot = previousSlot;
  }
  cream.slot = destinationSlot;
  const memo = memos.find((item) => item.id === cream.memoId);
  if (memo) {
    memo.creamSlot = destinationSlot;
    delete memo.creamTier;
  }
  saveData();
  renderMemoList();
}
function pointHitsPipingBag(mx, my) {
  const g = pipingBagGeometry();
  const local = screenToCake(mx, my);
  const dx = local.x - g.tipX;
  const dy = local.y - g.tipY;
  const c = Math.cos(g.angle);
  const s = Math.sin(g.angle);
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  // Expand the invisible hit target for fingertips without changing the bag.
  const hitSlop = Math.max(10, g.width * 0.11);
  if (lx < -g.length * 0.06 - hitSlop || lx > g.length * 1.0 + hitSlop)
    return false;
  if (lx <= g.length * 0.2) {
    const nozzleHalfWidth =
      g.width * (0.035 + 0.075 * ((lx + g.length * 0.06) / (g.length * 0.26)));
    return Math.abs(ly) <= nozzleHalfWidth + hitSlop;
  }
  const t = constrain((lx - g.length * 0.16) / (g.length * 0.8), 0, 1);
  const bodyHalfWidth = g.width * (0.105 + 0.37 * Math.sin(t * Math.PI * 0.5));
  return Math.abs(ly) <= bodyHalfWidth + hitSlop;
}
function startPipingMemo(targetAngle = pipingBagAngle) {
  if (activePipe && !activePipe.complete) return;
  const memo = memos.find(
    (m) => !m.archived && !m.piped && !m.completed && !m.settled,
  );
  if (!memo) {
    restartQuickGuide("create");
    const panel = document.getElementById("menuPanel");
    const formSection = document.getElementById("memoFormSection");
    if (panel) {
      panel.classList.add("open");
      panel.setAttribute("aria-hidden", "false");
    }
    document.getElementById("overlay")?.classList.add("open");
    document.getElementById("menuButton")?.classList.add("active");
    document
      .getElementById("menuButton")
      ?.setAttribute("aria-expanded", "true");
    if (formSection) formSection.classList.remove("hidden");
    const title = document.getElementById("memoTitle");
    if (title) title.focus();
    return;
  }
  const nextPosition = nextPipingPosition(targetAngle);
  if (!nextPosition) {
    cakeCapacityMessage =
      "The cake rim is full · Create space by moving a cream";
    updateProgressInfo();
    return;
  }
  cakeCapacityMessage = "";
  const { slot } = nextPosition;
  // Align the nozzle tip with the exact rim position where this cream lands.
  pipingBagAngle = cakeCreamAngleForSlot(slot);
  const cream = {
    id: `cream-${memo.id}`,
    memoId: memo.id,
    color:
      IMPORTANCE_CREAM_COLORS[Number(memo.importance)] ||
      IMPORTANCE_CREAM_COLORS[2],
    importance: Number(memo.importance) || 2,
    progress: 0.005,
    complete: false,
    seed: Math.random(),
    slot,
  };
  memo.creamSlot = cream.slot;
  memo.creamColor = cream.color;
  memo.creamSeed = cream.seed;
  activePipe = cream;
  pipedCreams.push(cream);
}
function nextPipingPosition(targetAngle = pipingBagAngle) {
  const occupied = new Set(pipedCreams.map((cream) => Number(cream.slot)));
  let best = null;
  let bestDistance = Infinity;
  for (let slot = 0; slot < MAX_CAKE_RIM_CREAMS; slot++) {
    if (occupied.has(slot)) continue;
    const difference = Math.atan2(
      Math.sin(cakeCreamAngleForSlot(slot) - targetAngle),
      Math.cos(cakeCreamAngleForSlot(slot) - targetAngle),
    );
    if (Math.abs(difference) < bestDistance) {
      best = { slot };
      bestDistance = Math.abs(difference);
    }
  }
  return best;
}
function restorePipedCreamsFromMemos() {
  const pipedMemos = memos.filter((memo) => memo.piped);
  const usedSlots = new Set();
  const positioned = new Set();
  let repaired = false;
  for (const memo of pipedMemos) {
    const slot = Number(memo.creamSlot);
    if (
      Number.isInteger(slot) &&
      slot >= 0 &&
      slot < CAKE_RIM_SLOT_COUNT &&
      !usedSlots.has(slot)
    ) {
      usedSlots.add(slot);
      positioned.add(memo.id);
    }
  }
  // Legacy second-tier creams are migrated to the interleaved rim positions.
  for (const memo of pipedMemos) {
    if (positioned.has(memo.id)) continue;
    const legacyTier = Number(memo.creamTier) || 0;
    const legacySlot = Number(memo.creamSlot);
    let targetSlot = null;
    if (
      legacyTier >= 1 &&
      Number.isInteger(legacySlot) &&
      legacySlot >= 0 &&
      legacySlot < CAKE_RIM_SLOT_COUNT
    ) {
      const interleavedSlot = CAKE_RIM_SLOT_COUNT + legacySlot;
      if (!usedSlots.has(interleavedSlot)) targetSlot = interleavedSlot;
    }
    if (targetSlot === null) {
      for (let slot = 0; slot < MAX_CAKE_RIM_CREAMS; slot++) {
        if (!usedSlots.has(slot)) {
          targetSlot = slot;
          break;
        }
      }
    }
    if (targetSlot === null) {
      // Keep overflow memos and their associations intact even if the visible rim is full.
      targetSlot = MAX_CAKE_RIM_CREAMS + Number(memo.id?.length || 0);
      while (usedSlots.has(targetSlot)) targetSlot++;
    }
    memo.creamSlot = targetSlot;
    delete memo.creamTier;
    usedSlots.add(targetSlot);
    positioned.add(memo.id);
    repaired = true;
  }
  for (const memo of pipedMemos) {
    if (Object.prototype.hasOwnProperty.call(memo, "creamTier")) {
      delete memo.creamTier;
      repaired = true;
    }
  }
  pipedCreams = pipedMemos.map((memo) => ({
    id: `cream-${memo.id}`,
    memoId: memo.id,
    color:
      IMPORTANCE_CREAM_COLORS[Number(memo.importance)] ||
      IMPORTANCE_CREAM_COLORS[2],
    importance: Number(memo.importance) || 2,
    progress: 1,
    complete: true,
    seed: Number.isFinite(Number(memo.creamSeed))
      ? Number(memo.creamSeed)
      : 0.5,
    slot: Number(memo.creamSlot) || 0,
  }));
  if (repaired) saveData();
}
function restoreArchivedMemos() {
  restoreMode = true;
  const formSection = document.getElementById("memoFormSection");
  const listSection = document.getElementById("memoListSection");
  listSection?.classList.add("restore-mode");
  if (formSection) formSection.classList.add("hidden");
  if (listSection) listSection.classList.add("visible");
  const listTitle = listSection
    ? listSection.querySelector(".section-title")
    : null;
  if (listTitle) listTitle.textContent = "RESTORE MEMO";
  renderMemoList();
}
function creamSurfaceAt(x) {
  const relativeX = (x - coffee.centerX) / (coffee.creamWidth * 0.5);
  const v = constrain(relativeX, -0.92, 0.92);
  const curve = 1 - v * v;
  return (
    coffee.cupTopY -
    coffee.creamHeight * 0.05 -
    coffee.creamHeight * 0.025 * curve
  );
}
function cubeSize(memo) {
  return IMPORTANCE_SIZES[memo.importance] || 29;
}
function shadeHex(hex, amount) {
  const value = hex.replace("#", "");
  const num = parseInt(value, 16);
  const r = constrain((num >> 16) + amount, 0, 255);
  const g = constrain(((num >> 8) & 0xff) + amount, 0, 255);
  const b = constrain((num & 0xff) + amount, 0, 255);
  return (
    "#" +
    [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")
  );
}
function hexToRgba(hex, alpha = 1) {
  const value = hex.replace("#", "");
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((character) => character + character)
          .join("")
      : value;
  const number = parseInt(normalized, 16);
  const red = (number >> 16) & 0xff;
  const green = (number >> 8) & 0xff;
  const blue = number & 0xff;
  return (
    "rgba(" +
    red +
    ", " +
    green +
    ", " +
    blue +
    ", " +
    constrain(alpha, 0, 1) +
    ")"
  );
}
function displayMemoColor(memo) {
  const storedColor = String(memo.creamColor || memo.color || "#D9D2EF");
  const normalized = storedColor.toUpperCase();
  if (normalized === "#D1F0E0")
    return (
      IMPORTANCE_CREAM_COLORS[Number(memo.importance)] ||
      IMPORTANCE_CREAM_COLORS[2]
    );
  if (normalized === "#B9DCC8")
    return memo.piped
      ? IMPORTANCE_CREAM_COLORS[Number(memo.importance)] ||
          IMPORTANCE_CREAM_COLORS[2]
      : "#D9D2EF";
  return storedColor;
}
function findInitialPosition(memo) {
  const size = cubeSize(memo);
  const x =
    coffee.centerX +
    random(-coffee.creamWidth * 0.25, coffee.creamWidth * 0.25);
  const y = coffee.cupTopY - coffee.creamHeight * 0.015 + size * 0.04;
  return { x, y };
}
function isFalling(id) {
  return fallingCubes.some((cube) => cube.id === id);
}
function updateFallingCubes() {
  for (let i = fallingCubes.length - 1; i >= 0; i--) {
    const cube = fallingCubes[i];
    const half = cube.size * 0.44;
    cube.previousY = cube.y;
    cube.vy = Math.min(cube.vy + 0.24, 12);
    cube.x += cube.vx;
    cube.y += cube.vy;
    cube.angle += cube.angularVelocity;
    cube.vx *= 0.995;
    cube.angularVelocity *= 0.995;
    const minX = coffee.centerX - coffee.creamWidth * 0.35;
    const maxX = coffee.centerX + coffee.creamWidth * 0.35;
    if (cube.x < minX) {
      cube.x = minX;
      cube.vx = Math.abs(cube.vx) * 0.35;
    }
    if (cube.x > maxX) {
      cube.x = maxX;
      cube.vx = -Math.abs(cube.vx) * 0.35;
    }
    const previousBottom = cube.previousY + half;
    const currentBottom = cube.y + half;
    let landingY = null;
    const creamY = creamSurfaceAt(cube.x);
    if (previousBottom <= creamY + 2 && currentBottom >= creamY)
      landingY = creamY - half;
    for (const other of memos) {
      if (
        other.archived ||
        other.settled ||
        other.completed ||
        other.id === cube.id ||
        isFalling(other.id) ||
        other.cubeX == null ||
        other.cubeY == null
      )
        continue;
      const otherSize = cubeSize(other);
      const overlapsX =
        Math.abs(cube.x - other.cubeX) < (cube.size + otherSize) * 0.46;
      if (!overlapsX) continue;
      const otherTop = other.cubeY - otherSize * 0.44;
      if (previousBottom <= otherTop + 2 && currentBottom >= otherTop) {
        const candidate = otherTop - half;
        if (landingY === null || candidate < landingY) landingY = candidate;
      }
    }
    if (landingY !== null) {
      cube.y = landingY;
      cube.vy = 0;
      cube.vx *= 0.15;
      cube.angularVelocity = 0;
      cube.angle *= 0.8;
      settleCube(cube);
      fallingCubes.splice(i, 1);
      continue;
    }
    if (cube.y > height + cube.size) {
      cube.y = creamSurfaceAt(cube.x) - half;
      settleCube(cube);
      fallingCubes.splice(i, 1);
    }
  }
}
function settleCube(cube) {
  const memo = memos.find((item) => item.id === cube.id);
  if (!memo) return;
  memo.cubeX = cube.x;
  memo.cubeY = cube.y;
  memo.cubeAngle = cube.angle;
  saveData();
}
function createFallingCube(memo) {
  if (!memo || memo.archived || memo.completed || memo.settled) return;
  const size = cubeSize(memo);
  const cube = {
    id: memo.id,
    title: memo.title,
    body: memo.body,
    category: memo.category,
    importance: memo.importance,
    type: memo.type || "memory",
    completed: Boolean(memo.completed),
    settled: Boolean(memo.settled),
    color: displayMemoColor(memo),
    archived: false,
    size,
    x: random(
      coffee.centerX - coffee.creamWidth * 0.25,
      coffee.centerX + coffee.creamWidth * 0.25,
    ),
    y: -size - random(10, 100),
    previousY: -size - 100,
    vx: random(-0.5, 0.5),
    vy: 0,
    angle: random(-0.25, 0.25),
    angularVelocity: random(-0.008, 0.008),
  };
  memo.cubeX = cube.x;
  memo.cubeY = cube.y;
  memo.cubeAngle = cube.angle;
  fallingCubes.push(cube);
}
function pointerPressed(pointerX, pointerY) {
  if (selectedCakeSlice && selectedCakeSlice.closing) return false;
  const menuPanel = document.getElementById("menuPanel");
  if (menuPanel && menuPanel.classList.contains("open")) return;
  const modal = document.getElementById("detailModal");
  if (modal && modal.classList.contains("open")) return;
  lastPointerX = pointerX;
  lastPointerY = pointerY;
  const local = screenToCake(pointerX, pointerY);
  let target = null;
  // Resolve front-most controls before nearby cream targets. This is especially
  // important on touch screens, where a fingertip can cover several hit areas.
  if (
    celebrationState === "candle" &&
    pointHitsCenterCandle(local.x, local.y)
  ) {
    target = { type: "candle" };
  } else if (
    celebrationState === "normal" &&
    pointHitsPipingBag(pointerX, pointerY)
  ) {
    target = { type: "bag" };
  }
  const visibleCreams = orderedPipedCreams();
  for (let i = visibleCreams.length - 1; !target && i >= 0; i--) {
    const cream = visibleCreams[i];
    const memo = memos.find((item) => item.id === cream.memoId);
    if (!memo || memo.archived) continue;
    if (pointHitsPipedCream(pointerX, pointerY, cream)) {
      target = { type: "cream", memoId: memo.id, cream };
      break;
    }
  }
  cakeGesture = {
    startX: pointerX,
    startY: pointerY,
    lastX: pointerX,
    lastY: pointerY,
    startRotation: cakeRotation,
    moved: false,
    target,
  };
  return false;
}
function pointerDragged(pointerX, pointerY) {
  lastPointerX = pointerX;
  lastPointerY = pointerY;
  if (cakeGesture) {
    const distance = Math.hypot(
      pointerX - cakeGesture.startX,
      pointerY - cakeGesture.startY,
    );
    const movementThreshold =
      cakeGesture.target?.type === "cream"
        ? 12
        : cakeGesture.target?.type === "bag" ||
            cakeGesture.target?.type === "candle"
          ? 16
          : 18;
    if (!cakeGesture.moved && distance > movementThreshold) {
      cakeGesture.moved = true;
      cakeGesture.mode =
        cakeGesture.target?.type === "cream"
          ? "cream"
          : cakeGesture.target?.type === "bag"
            ? "bag"
            : "none";
      if (cakeGesture.mode === "cream")
        updateCreamDragPreview(cakeGesture, pointerX, pointerY);
    }
    if (cakeGesture.moved) {
      if (cakeGesture.mode === "cream") {
        updateCreamDragPreview(cakeGesture, pointerX, pointerY);
      } else if (cakeGesture.mode === "bag") {
        updatePipingBagDrag(pointerX, pointerY);
      }
      cakeGesture.lastX = pointerX;
      cakeGesture.lastY = pointerY;
      return false;
    }
  }
  if (potentialMemoDragId) {
    const distance = Math.hypot(
      pointerX - memoDragStart.x,
      pointerY - memoDragStart.y,
    );
    if (!memoDragMoved && distance < 6) return false;
    memoDragMoved = true;
    draggingMemoId = potentialMemoDragId;
    const memo = memos.find((item) => item.id === draggingMemoId);
    if (!memo) return false;
    fallingCubes = fallingCubes.filter((cube) => cube.id !== draggingMemoId);
    memo.cubeX = pointerX;
    memo.cubeY = pointerY;
    memo.cubeAngle = 0;
    return false;
  }
}
function updatePipingBagDrag(mx, my) {
  const local = screenToCake(mx, my);
  const normalizedX = (local.x - coffee.centerX) / (coffee.cupWidth * 0.5);
  const normalizedY = (local.y - coffee.cupTopY) / (coffee.cupWidth * 0.0925);
  if (Math.hypot(normalizedX, normalizedY) < 0.08) return;
  pipingBagAngle = Math.atan2(normalizedY, normalizedX);
}
function isPointInsideCoffee(x, y) {
  return (
    Math.abs(x - coffee.centerX) <= coffee.cupWidth * 0.39 &&
    y >= coffee.cupTopY - coffee.cupWidth * 0.16 &&
    y <= coffee.cupTopY + coffee.cupWidth * 0.2
  );
}
function pointerReleased(pointerX, pointerY) {
  lastPointerX = pointerX;
  lastPointerY = pointerY;
  if (cakeGesture) {
    const gesture = cakeGesture;
    cakeGesture = null;
    if (gesture.moved) {
      if (gesture.mode === "cream") commitCreamDrag(gesture);
      else if (gesture.mode === "bag") {
        creamDragPreview = null;
        saveData();
      }
      return false;
    }
    if (gesture.target?.type === "bag") startPipingMemo(pipingBagAngle);
    else if (gesture.target?.type === "candle") startFireworks();
    else if (gesture.target?.type === "cream")
      openMemoDetail(gesture.target.memoId, gesture.target.cream);
    return false;
  }
  if (potentialMemoDragId) {
    const memo = memos.find((item) => item.id === potentialMemoDragId);
    if (memo && memoDragMoved) {
      const releasePoint = screenToCake(pointerX, pointerY);
      if (isPointInsideCoffee(releasePoint.x, releasePoint.y)) {
        memo.settledReturnX = memoDragStart.x;
        memo.settledReturnY = memoDragStart.y;
        memo.settled = true;
        memo.settledAt = new Date().toISOString();
      } else {
        memo.cubeX = memoDragStart.x;
        memo.cubeY = memoDragStart.y;
        memo.cubeAngle = memoDragStart.angle;
      }
      saveData();
      renderMemoList();
    } else if (memo && !memoDragMoved) openMemoDetail(memo.id);
    potentialMemoDragId = null;
    draggingMemoId = null;
    memoDragStart = null;
    memoDragMoved = false;
    return false;
  }
}
function pointerPointFromEvent(event, canvasElement) {
  const rect = canvasElement.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * width,
    y: ((event.clientY - rect.top) / rect.height) * height,
  };
}
function installCanvasPointerEvents(canvasElement) {
  canvasElement.addEventListener(
    "pointerdown",
    (event) => {
      if (
        !event.isPrimary ||
        (event.pointerType === "mouse" && event.button !== 0)
      )
        return;
      if (activePointerId !== null) return;
      event.preventDefault();
      activePointerId = event.pointerId;
      try {
        canvasElement.setPointerCapture(event.pointerId);
      } catch (_) {}
      const point = pointerPointFromEvent(event, canvasElement);
      pointerPressed(point.x, point.y);
    },
    { passive: false },
  );
  canvasElement.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerId !== activePointerId) return;
      event.preventDefault();
      const point = pointerPointFromEvent(event, canvasElement);
      pointerDragged(point.x, point.y);
    },
    { passive: false },
  );
  const finishPointer = (event) => {
    if (event.pointerId !== activePointerId) return;
    event.preventDefault();
    const point = pointerPointFromEvent(event, canvasElement);
    activePointerId = null;
    pointerReleased(point.x, point.y);
  };
  canvasElement.addEventListener("pointerup", finishPointer, {
    passive: false,
  });
  canvasElement.addEventListener(
    "pointercancel",
    (event) => {
      if (event.pointerId !== activePointerId) return;
      event.preventDefault();
      activePointerId = null;
      cakeGesture = null;
      creamDragPreview = null;
      if (potentialMemoDragId) {
        potentialMemoDragId = null;
        draggingMemoId = null;
        memoDragStart = null;
        memoDragMoved = false;
      }
    },
    { passive: false },
  );
}
function mousePressed() {
  if (window.PointerEvent || Date.now() - lastTouchAt < 750) return false;
  return pointerPressed(mouseX, mouseY);
}
function mouseDragged() {
  if (window.PointerEvent || Date.now() - lastTouchAt < 750) return false;
  return pointerDragged(mouseX, mouseY);
}
function mouseReleased() {
  if (window.PointerEvent || Date.now() - lastTouchAt < 750) return false;
  return pointerReleased(mouseX, mouseY);
}
function touchStarted() {
  if (window.PointerEvent) return false;
  lastTouchAt = Date.now();
  const touch = touches?.[0];
  if (!touch) return false;
  pointerPressed(touch.x, touch.y);
  return false;
}
function touchMoved() {
  if (window.PointerEvent) return false;
  lastTouchAt = Date.now();
  const touch = touches?.[0];
  if (touch) pointerDragged(touch.x, touch.y);
  return false;
}
function touchEnded() {
  if (window.PointerEvent) return false;
  lastTouchAt = Date.now();
  pointerReleased(lastPointerX, lastPointerY);
  return false;
}
function pointHitsCube(px, py, cx, cy, size) {
  if (cx == null || cy == null) return false;
  return Math.abs(px - cx) <= size * 0.65 && Math.abs(py - cy) <= size * 0.65;
}
function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const data = JSON.parse(saved);
    if (!Array.isArray(data.memos)) throw new Error("保存数据格式无效");
    memos = data.memos;
    if (Array.isArray(data.categories) && data.categories.length)
      categories = data.categories;
    cakeRotation = 0;
    if (Number.isFinite(Number(data.pipingBagAngle)))
      pipingBagAngle = Number(data.pipingBagAngle);
  } catch (error) {
    storageReadFailed = true;
    console.error("无法读取保存的数据：", error);
  }
}
function saveData() {
  if (storageReadFailed) {
    console.error("读取保存数据失败，已暂停写入以免覆盖原数据。");
    return false;
  }
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ memos, categories, cakeRotation, pipingBagAngle }),
    );
    storageWriteFailed = false;
    return true;
  } catch (error) {
    storageWriteFailed = true;
    console.error("无法保存数据：", error);
    return false;
  }
}
function setupUI() {
  updateCategoryOptions();
  updateFilterCategoryOptions();
  setupCustomSelects();
  setupMenu();
  setupMemoForm();
  setupFilters();
  setupSearch();
  setupDetailModal();
  renderMemoList();
  updateProgressInfo();
}
function setupCustomSelects() {
  const controls = [...document.querySelectorAll("[data-select-control]")];
  const closeAll = (except = null) => {
    for (const control of controls) {
      if (control === except) continue;
      control.classList.remove("open");
      control
        .querySelector(".select-trigger")
        ?.setAttribute("aria-expanded", "false");
    }
  };
  const refresh = (control) => {
    const id = control.dataset.selectControl;
    const select = document.getElementById(id);
    const trigger = control.querySelector(".select-trigger");
    const value = control.querySelector(".select-value");
    const options = control.querySelector(".select-options");
    if (!select || !trigger || !value || !options) return;
    const selected = [...select.options].find(
      (option) => option.value === select.value,
    );
    value.textContent = selected?.textContent || "Select an option";
    const label = document
      .querySelector(`label[for="${id}"]`)
      ?.textContent?.trim();
    if (label && !trigger.hasAttribute("aria-label")) {
      trigger.setAttribute("aria-label", label);
    }
    options.replaceChildren();
    for (const option of select.options) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "select-option";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.value === select.value));
      item.textContent = option.textContent;
      item.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refresh(control);
        control.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        trigger.focus({ preventScroll: true });
      });
      options.appendChild(item);
    }
  };
  for (const control of controls) {
    const id = control.dataset.selectControl;
    const select = document.getElementById(id);
    const trigger = control.querySelector(".select-trigger");
    if (!select || !trigger) continue;
    refresh(control);
    select.addEventListener("change", () => refresh(control));
    trigger.addEventListener("click", () => {
      const opening = !control.classList.contains("open");
      closeAll(control);
      control.classList.toggle("open", opening);
      trigger.setAttribute("aria-expanded", String(opening));
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAll();
        trigger.focus();
      } else if (
        event.key === "ArrowDown" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        control.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
        control.querySelector(".select-options .select-option")?.focus();
      }
    });
    control
      .querySelector(".select-options")
      ?.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeAll();
          trigger.focus();
        }
      });
  }
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("[data-select-control]")) closeAll();
  });
  window.refreshMemoSelects = () => controls.forEach(refresh);
}
function setupMenu() {
  const menuButton = document.getElementById("menuButton");
  const menuPanel = document.getElementById("menuPanel");
  const menuClose = document.getElementById("menuClose");
  const overlay = document.getElementById("overlay");
  const writeButton = document.getElementById("newMemoButton");
  const browseButton = document.getElementById("browseMemosButton");
  const restoreButton = document.getElementById("restoreMemoButton");
  const cancelButton = document.getElementById("cancelForm");
  const formSection = document.getElementById("memoFormSection");
  const listSection = document.getElementById("memoListSection");
  // Keep panel interactions local. Do not prevent the browser's default action:
  // text editing and native select pickers must remain available on touch devices.
  menuPanel?.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  menuPanel?.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  const closeMenu = () => {
    if (menuPanel) menuPanel.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
    if (menuButton) {
      menuButton.classList.remove("active");
      menuButton.setAttribute("aria-expanded", "false");
    }
    if (menuPanel) menuPanel.setAttribute("aria-hidden", "true");
  };
  if (menuButton)
    menuButton.addEventListener("click", () => {
      if (menuPanel) menuPanel.classList.toggle("open");
      if (overlay) overlay.classList.toggle("open");
      const isOpen = Boolean(menuPanel?.classList.contains("open"));
      menuButton.classList.toggle("active");
      menuButton.setAttribute(
        "aria-expanded",
        String(menuButton.classList.contains("active")),
      );
      if (menuPanel)
        menuPanel.setAttribute(
          "aria-hidden",
          String(!menuPanel.classList.contains("open")),
        );
    });
  if (menuClose) menuClose.addEventListener("click", closeMenu);
  if (overlay) overlay.addEventListener("click", closeMenu);
  const openMemoForm = () => {
    restartQuickGuide("create");
    restoreMode = false;
    listSection?.classList.remove("restore-mode");
    editingMemoId = null;
    const idInput = document.getElementById("memoId");
    const heading = document.getElementById("formHeading");
    const form = document.getElementById("memoForm");
    if (idInput) idInput.value = "";
    if (heading) heading.textContent = "NEW MEMO";
    if (form) form.reset();
    window.refreshMemoSelects?.();
    listSection?.classList.remove("visible");
    formSection?.classList.remove("hidden");
    menuPanel?.classList.add("open");
    menuPanel?.setAttribute("aria-hidden", "false");
    overlay?.classList.add("open");
    menuButton?.classList.add("active");
    menuButton?.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => document.getElementById("memoTitle")?.focus());
  };
  if (writeButton)
    writeButton.addEventListener("click", (event) => {
      event.preventDefault();
      openMemoForm();
    });
  if (browseButton)
    browseButton.addEventListener("click", () => {
      restoreMode = false;
      listSection?.classList.remove("restore-mode");
      editingMemoId = null;
      formSection?.classList.add("hidden");
      listSection?.classList.add("visible");
      const heading = listSection?.querySelector(".section-title");
      if (heading) heading.textContent = "YOUR MEMOS";
      renderMemoList();
    });
  if (restoreButton)
    restoreButton.addEventListener("click", restoreArchivedMemos);
  if (cancelButton)
    cancelButton.addEventListener("click", () => {
      const form = document.getElementById("memoForm");
      if (form) form.reset();
      window.refreshMemoSelects?.();
      editingMemoId = null;
      document.getElementById("memoId").value = "";
      document.getElementById("formHeading").textContent = "NEW MEMO";
      if (formSection) formSection.classList.add("hidden");
    });
}
function setupMemoForm() {
  const form = document.getElementById("memoForm");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const titleInput = document.getElementById("memoTitle");
    const bodyInput = document.getElementById("memoBody");
    const categoryInput = document.getElementById("memoCategory");
    const importanceInput = document.getElementById("memoImportance");
    const scheduledAtInput = document.getElementById("memoScheduledAt");
    const memoIdInput = document.getElementById("memoId");
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return;
    }
    const category =
      categoryInput && categoryInput.value ? categoryInput.value : "Personal";
    const importance = Number(importanceInput.value) || 2;
    const existingMemo = memos.find((memo) => memo.id === editingMemoId);
    if (existingMemo) {
      existingMemo.title = title;
      existingMemo.body = bodyInput.value.trim();
      existingMemo.category = category;
      existingMemo.importance = importance;
      existingMemo.scheduledAt = normalizeMemoDateTime(scheduledAtInput?.value);
      if (existingMemo.piped) {
        const cream = pipedCreams.find(
          (item) => item.memoId === existingMemo.id,
        );
        if (cream) {
          cream.importance = importance;
          cream.color =
            IMPORTANCE_CREAM_COLORS[importance] || IMPORTANCE_CREAM_COLORS[2];
          existingMemo.creamColor = cream.color;
        }
      }
    } else {
      memos.push({
        id: "memo-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        title,
        body: bodyInput.value.trim(),
        category,
        importance,
        scheduledAt: normalizeMemoDateTime(scheduledAtInput?.value),
        type: "memory",
        completed: false,
        settled: false,
        archived: false,
        piped: false,
        color: random(PASTEL_COLORS),
        createdAt: new Date().toISOString(),
        cubeX: coffee.centerX,
        cubeY: coffee.cupTopY - 10,
        cubeAngle: random(-0.1, 0.1),
      });
      setQuickGuideStep("pipe");
    }
    editingMemoId = null;
    if (memoIdInput) memoIdInput.value = "";
    document.getElementById("formHeading").textContent = "NEW MEMO";
    saveData();
    renderMemoList();
    updateProgressInfo();
    form.reset();
    const section = document.getElementById("memoFormSection");
    if (section) section.classList.add("hidden");
    if (titleInput) titleInput.blur();
  });
}
function setupFilters() {
  for (const id of ["memoStatusFilter", "memoCategoryFilter"])
    document.getElementById(id)?.addEventListener("change", renderMemoList);
}
function setupSearch() {
  const searchInput = document.getElementById("memoSearch");
  if (!searchInput) return;

  // Explicitly focus on touch so iPad Safari shows the caret and keyboard.
  searchInput.addEventListener("pointerdown", () => {
    searchInput.focus({ preventScroll: true });
  });
  searchInput.addEventListener("input", renderMemoList);
}
function updateProgressInfo() {
  const element = document.getElementById("progressInfo");
  if (!element) return;
  if (storageReadFailed) {
    element.textContent =
      "Saved data could not be read · Original data preserved";
    return;
  }
  if (storageWriteFailed) {
    element.textContent = "Could not save changes · Check browser storage";
    return;
  }
  if (cakeCapacityMessage) {
    element.textContent = cakeCapacityMessage;
    return;
  }
  const activeMemos = memos.filter((memo) => !memo.archived);
  const completed = activeMemos.filter((memo) => memo.completed).length;
  const pending = activeMemos.length - completed;
  element.textContent = activeMemos.length
    ? `${activeMemos.length} Memos · ${completed} Completed · ${pending} Pending`
    : "No Memos yet · Write a Memo to begin";
}
function setupDetailModal() {
  const modal = document.getElementById("detailModal");
  const closeButton = document.getElementById("detailClose");
  const archiveButton = document.getElementById("detailArchive");
  const editButton = document.getElementById("detailEdit");
  if (closeButton) closeButton.addEventListener("click", closeMemoDetail);
  if (archiveButton)
    archiveButton.addEventListener("click", () => {
      const memo = memos.find((item) => item.id === selectedMemoId);
      if (memo) {
        memo.archived = true;
        saveData();
        closeMemoDetail();
        renderMemoList();
      }
    });
  if (editButton)
    editButton.addEventListener("click", () => {
      const memo = memos.find((item) => item.id === selectedMemoId);
      if (!memo) return;
      editingMemoId = memo.id;
      document.getElementById("memoId").value = memo.id;
      document.getElementById("memoTitle").value = memo.title;
      document.getElementById("memoBody").value = memo.body || "";
      document.getElementById("memoCategory").value =
        memo.category || "Personal";
      document.getElementById("memoImportance").value = String(
        memo.importance || 2,
      );
      window.refreshMemoSelects?.();
      document.getElementById("memoScheduledAt").value = toLocalDateTimeValue(
        memo.scheduledAt,
      );
      document.getElementById("formHeading").textContent = "EDIT MEMO";
      const formSection = document.getElementById("memoFormSection");
      if (formSection) formSection.classList.remove("hidden");
      const listSection = document.getElementById("memoListSection");
      if (listSection) listSection.classList.remove("visible");
      const menuPanel = document.getElementById("menuPanel");
      const overlay = document.getElementById("overlay");
      const menuButton = document.getElementById("menuButton");
      menuPanel?.classList.add("open");
      menuPanel?.setAttribute("aria-hidden", "false");
      overlay?.classList.add("open");
      menuButton?.classList.add("active");
      menuButton?.setAttribute("aria-expanded", "true");
      closeMemoDetail();
    });
  if (modal)
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeMemoDetail();
    });
}
function openMemoDetail(id, cream = null) {
  const memo = memos.find((item) => item.id === id);
  if (!memo) return;
  selectedMemoId = id;
  if (cream && cream.memoId === id)
    selectedCakeSlice = {
      memoId: id,
      slot: cream.slot,
      progress: 0,
      closing: false,
    };
  const modal = document.getElementById("detailModal");
  refreshMemoDetail(memo);
  if (modal) {
    modal.classList.toggle("sliceDetail", Boolean(cream));
    modal.classList.add("open");
  }
  if (cream) positionDetailCardNearSlice(cream.slot);
}
function refreshMemoDetail(memo) {
  const title = document.getElementById("detailTitle");
  const body = document.getElementById("detailBody");
  const meta = document.getElementById("detailMeta");
  const schedule = document.getElementById("detailSchedule");
  const color = document.getElementById("detailColor");
  const completionTag = document.getElementById("detailCompletionTag");
  if (title) title.textContent = memo.title;
  if (body) body.textContent = memo.body || "";
  if (schedule) {
    schedule.textContent = memo.scheduledAt
      ? "Scheduled: " + formatMemoSchedule(memo.scheduledAt)
      : "";
  }
  if (meta) {
    const importance =
      { 1: "Low", 2: "Medium", 3: "High" }[memo.importance] || "Medium";
    const status = memo.completed
      ? "Completed"
      : memo.piped
        ? "Piped"
        : "Waiting to pipe";
    meta.textContent = `${memo.category || "Personal"} · ${importance} · ${status}`;
  }
  if (color) color.style.background = displayMemoColor(memo);
  if (completionTag)
    completionTag.classList.toggle("visible", Boolean(memo.completed));
}
function positionDetailCardNearSlice(slot) {
  const card = document.querySelector("#detailModal .detail-card");
  if (!card) return;
  const { center } = cakeSliceAngles(slot);
  const geometry = cakeGeometry();
  const offset = cakeSliceOffset(slot, 1);
  const anchor = cakeToScreen(
    coffee.centerX + geometry.width * 0.455 * Math.cos(center) + offset.x,
    geometry.topY + geometry.width * 0.081 * Math.sin(center) + offset.y,
  );
  card.style.left = "0px";
  card.style.top = "0px";
  requestAnimationFrame(() => {
    const rect = card.getBoundingClientRect();
    const margin = 16;
    let left = anchor.x + 48;
    if (left + rect.width > window.innerWidth - margin)
      left = anchor.x - rect.width - 48;
    left = constrain(
      left,
      margin,
      Math.max(margin, window.innerWidth - rect.width - margin),
    );
    const top = constrain(
      anchor.y - Math.min(rect.height * 0.45, 150),
      margin,
      Math.max(margin, window.innerHeight - rect.height - margin),
    );
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  });
}
function closeMemoDetail() {
  const modal = document.getElementById("detailModal");
  if (modal) modal.classList.remove("open", "sliceDetail");
  const card = document.querySelector("#detailModal .detail-card");
  if (card) {
    card.style.left = "";
    card.style.top = "";
  }
  if (selectedCakeSlice) selectedCakeSlice.closing = true;
  selectedMemoId = null;
}
function renderMemoList() {
  const list = document.getElementById("memoList");
  updateProgressInfo();
  if (!list) return;
  const searchText = (document.getElementById("memoSearch")?.value || "")
    .trim()
    .toLowerCase();
  const selectedStatus =
    document.getElementById("memoStatusFilter")?.value || "all";
  const selectedCategory =
    document.getElementById("memoCategoryFilter")?.value || "all";
  const sectionTitle = document.querySelector(
    "#memoListSection .section-title",
  );
  if (sectionTitle)
    sectionTitle.textContent = restoreMode ? "RESTORE MEMO" : "YOUR MEMOS";
  list.innerHTML = "";
  const filtered = memos
    .filter((memo) => {
      if (restoreMode ? !memo.archived : memo.archived) return false;
      if (
        searchText &&
        !memo.title.toLowerCase().includes(searchText) &&
        !(memo.body || "").toLowerCase().includes(searchText)
      )
        return false;
      if (selectedCategory !== "all" && memo.category !== selectedCategory)
        return false;
      if (restoreMode) return true;
      if (selectedStatus === "pending" && memo.completed) return false;
      if (selectedStatus === "completed" && !memo.completed) return false;
      if (selectedStatus === "high" && Number(memo.importance) !== 3)
        return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  if (!filtered.length) {
    list.innerHTML = `<div class="emptyState">${restoreMode ? "No deleted memos to restore." : "No memos yet. Write a memo, then click the piping bag to create its cream."}</div>`;
    return;
  }
  for (const memo of filtered) {
    const item = document.createElement("div");
    item.className = "memo-item";
    if (!restoreMode) {
      const checkLabel = document.createElement("label");
      checkLabel.className = "memo-check";
      checkLabel.title = memo.completed
        ? "Mark as pending"
        : "Mark as complete";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = Boolean(memo.completed);
      check.setAttribute(
        "aria-label",
        memo.completed
          ? "Reopen " + memo.title
          : "Mark " + memo.title + " complete",
      );
      check.addEventListener("change", () => {
        const wasCompleted = Boolean(memo.completed);
        memo.completed = check.checked;
        if (!wasCompleted && memo.completed) requestCompletionCelebration();
        saveData();
        updateProgressInfo();
        if (selectedMemoId === memo.id) refreshMemoDetail(memo);
        renderMemoList();
      });
      checkLabel.appendChild(check);
      item.appendChild(checkLabel);
    }
    const swatch = document.createElement("span");
    swatch.className = "memo-color";
    swatch.style.background = displayMemoColor(memo);
    const info = document.createElement("div");
    info.className = "memo-info";
    const title = document.createElement("strong");
    title.textContent = memo.title;
    const body = document.createElement("p");
    body.textContent = memo.body || "";
    const meta = document.createElement("div");
    meta.className = "memo-meta";
    const importance =
      { 1: "Low", 2: "Medium", 3: "High" }[memo.importance] || "Medium";
    const status = memo.completed
      ? "Completed"
      : memo.piped
        ? "Piped"
        : "Waiting to pipe";
    meta.textContent = `${memo.category || "Personal"} · ${importance} · ${status}`;
    info.append(title, body, meta);
    if (memo.scheduledAt) {
      const scheduled = document.createElement("div");
      scheduled.className = "memo-date";
      scheduled.textContent =
        "Scheduled: " + formatMemoSchedule(memo.scheduledAt);
      info.appendChild(scheduled);
    }
    if (memo.completed && !restoreMode) {
      const completedTag = document.createElement("span");
      completedTag.className = "memo-status-tag";
      completedTag.textContent = "✓ Completed";
      info.appendChild(completedTag);
    }
    const actions = document.createElement("div");
    actions.className = "memo-actions";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "smallButton";
    action.textContent = restoreMode ? "Restore" : "View";
    action.addEventListener("click", () => {
      if (restoreMode) {
        memo.archived = false;
        saveData();
        renderMemoList();
      } else openMemoDetail(memo.id);
    });
    actions.appendChild(action);
    if (!restoreMode) {
      const archive = document.createElement("button");
      archive.type = "button";
      archive.className = "smallButton";
      archive.textContent = "Delete";
      archive.addEventListener("click", () => {
        memo.archived = true;
        saveData();
        renderMemoList();
      });
      actions.appendChild(archive);
    }
    item.append(swatch, info, actions);
    list.appendChild(item);
  }
}
function normalizeMemoDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
function toLocalDateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function formatMemoSchedule(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function updateCategoryOptions() {
  const categorySelect = document.getElementById("memoCategory");
  if (!categorySelect) return;
  const currentValue = categorySelect.value;
  categorySelect.innerHTML = "";
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  }
  if (categories.includes(currentValue)) categorySelect.value = currentValue;
  window.refreshMemoSelects?.();
}
function updateFilterCategoryOptions() {
  const categorySelect = document.getElementById("memoCategoryFilter");
  if (!categorySelect) return;
  const currentValue = categorySelect.value || "all";
  categorySelect.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All categories";
  categorySelect.appendChild(allOption);
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  }
  categorySelect.value = categories.includes(currentValue)
    ? currentValue
    : "all";
  window.refreshMemoSelects?.();
}
function addCategory(name) {
  const category = name.trim();
  if (!category || categories.includes(category)) return false;
  categories.push(category);
  saveData();
  updateCategoryOptions();
  updateFilterCategoryOptions();
  renderMemoList();
  return true;
}
function deleteCategory(name) {
  if (categories.length <= 1) return false;
  categories = categories.filter((category) => category !== name);
  if (categories.length === 0) categories = ["Personal"];
  for (const memo of memos)
    if (memo.category === name) memo.category = categories[0];
  saveData();
  updateCategoryOptions();
  updateFilterCategoryOptions();
  renderMemoList();
  return true;
}
function archiveSelectedMemo() {
  if (!selectedMemoId) return;
  const memo = memos.find((item) => item.id === selectedMemoId);
  if (!memo) return;
  memo.archived = true;
  closeMemoDetail();
  saveData();
  renderMemoList();
}
