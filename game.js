const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gameWrap = document.getElementById("gameWrap");
const scoreText = document.getElementById("scoreText");
const bestScoreText = document.getElementById("bestScoreText");
const lifeText = document.getElementById("lifeText");
const comboText = document.getElementById("comboText");
const timeText = document.getElementById("timeText");
const speedGauge = document.getElementById("speedGauge");
const speedGaugeLabel = document.getElementById("speedGaugeLabel");
const speedGaugeFill = document.getElementById("speedGaugeFill");
const speedGaugeValue = document.getElementById("speedGaugeValue");
const message = document.getElementById("message");

const BEST_SCORE_KEY = "foodCatchGameBestScore";
const BASE_FOOD_SPEED = 180;
const RANDOM_FOOD_SPEED = 120;
const SPEED_UP_PER_SECOND = 14;
const SPEED_LEVEL_INTERVAL = 12;
const MAX_LIFE = 3;
const START_FOOD_LIMIT = 1;
const EXTRA_FOOD_INTERVAL = 10;
const BOMB_CHANCE = 0.1;
const LIFE_ITEM_CHANCE = 0.1;
const BONUS_ITEM_CHANCE = 0.14;

const DIFFICULTIES = {
  easy: {
    label: "やさしい",
    summary: "最大2個 / ゆっくり",
    speedMultiplier: 0.65,
    maxActiveFoods: 2
  },
  normal: {
    label: "ふつう",
    summary: "最大3個 / 標準",
    speedMultiplier: 0.82,
    maxActiveFoods: 3
  },
  hard: {
    label: "むずかしい",
    summary: "最大4個 / 旧設定の速度",
    speedMultiplier: 1,
    maxActiveFoods: 4
  }
};

const ITEM_TYPES = {
  food: {
    score: 10,
    size: 42
  },
  bonus: {
    score: 35,
    size: 46
  },
  life: {
    score: 0,
    size: 44
  },
  bomb: {
    score: 0,
    size: 44
  }
};

let width;
let height;

let score = 0;
let bestScore = loadBestScore();
let life = MAX_LIFE;
let combo = 0;
let maxCombo = 0;
let isPlaying = false;
let lastTime = 0;
let elapsedTime = 0;
let audioContext = null;
let selectedDifficulty = DIFFICULTIES.hard;
let lastLane = -1;
let sameLaneCount = 0;

const player = {
  x: 0,
  y: 0,
  width: 96,
  height: 46,
  speed: 450
};

const foods = [];
const particles = [];

const foodImages = [
  loadGameImage("assets/apple.svg"),
  loadGameImage("assets/rice-ball.svg"),
  loadGameImage("assets/burger.svg"),
  loadGameImage("assets/strawberry.svg"),
  loadGameImage("assets/carrot.svg")
];
const lifeImage = loadGameImage("assets/life.svg");
const bombImage = loadGameImage("assets/bomb.svg");
const bonusImage = loadGameImage("assets/golden-food.svg");
const basketImage = loadGameImage("assets/basket.svg");

const keys = {
  left: false,
  right: false
};

function loadBestScore() {
  const savedScore = Number(localStorage.getItem(BEST_SCORE_KEY));
  return Number.isFinite(savedScore) && savedScore > 0 ? savedScore : 0;
}

function saveBestScore() {
  localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
}

function updateBestScore() {
  if (score > bestScore) {
    bestScore = score;
    saveBestScore();
  }
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playTone(frequency, duration, type, startGain) {
  const context = getAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(startGain, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playCatchSound() {
  playTone(660, 0.08, "sine", 0.22);
  setTimeout(() => playTone(990, 0.1, "sine", 0.18), 45);
}

function playBonusSound() {
  playTone(780, 0.07, "triangle", 0.2);
  setTimeout(() => playTone(1170, 0.08, "triangle", 0.16), 55);
  setTimeout(() => playTone(1560, 0.08, "triangle", 0.12), 105);
}

function playMissSound() {
  playTone(180, 0.22, "sawtooth", 0.18);
}

function loadGameImage(src) {
  const image = new Image();
  image.src = src;
  image.addEventListener("load", () => {
    if (!isPlaying) {
      draw();
    }
  });
  return image;
}

function resizeCanvas() {
  const rect = gameWrap.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  width = rect.width;
  height = rect.height;

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  player.x = clamp(player.x || width / 2, player.width / 2, width - player.width / 2);
  player.y = height - Math.max(66, height * 0.09);

  draw();
}

function startGame(difficulty = selectedDifficulty) {
  getAudioContext();

  selectedDifficulty = difficulty;
  score = 0;
  life = MAX_LIFE;
  combo = 0;
  maxCombo = 0;
  foods.length = 0;
  particles.length = 0;
  elapsedTime = 0;
  lastLane = -1;
  sameLaneCount = 0;
  isPlaying = true;
  player.x = width / 2;
  fillFoods();

  updateUI();
  message.classList.add("hidden");

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function gameLoop(time) {
  if (!isPlaying) return;

  const deltaTime = Math.min((time - lastTime) / 1000, 0.033);
  lastTime = time;

  update(deltaTime);
  draw();

  requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
  elapsedTime += deltaTime;

  if (keys.left) player.x -= player.speed * deltaTime;
  if (keys.right) player.x += player.speed * deltaTime;

  player.x = clamp(player.x, player.width / 2, width - player.width / 2);

  fillFoods();
  updateFoods(deltaTime);
  updateParticles(deltaTime);
  updateUI();
}

function updateFoods(deltaTime) {
  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    food.y += food.speed * deltaTime;
    food.rotation += food.spin * deltaTime;

    if (isHit(food)) {
      foods.splice(i, 1);
      handleCatch(food);
      continue;
    }

    if (food.y > height + 44) {
      foods.splice(i, 1);
      handleMiss(food);
    }
  }
}

function updateParticles(deltaTime) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.age += deltaTime;
    particle.x += particle.vx * deltaTime;
    particle.y += particle.vy * deltaTime;
    particle.vy += 220 * deltaTime;

    if (particle.age >= particle.life) {
      particles.splice(i, 1);
    }
  }
}

function handleCatch(food) {
  if (food.type === "bomb") {
    combo = 0;
    life--;
    spawnFloatText(food.x, food.y, "BOMB!", "#ff5f6d");
    playMissSound();
    if (life <= 0) {
      gameOver();
    }
    return;
  }

  combo++;
  maxCombo = Math.max(maxCombo, combo);

  if (food.type === "life") {
    life = Math.min(MAX_LIFE, life + 1);
    spawnFloatText(food.x, food.y, "+LIFE", "#2ec4b6");
    playBonusSound();
    return;
  }

  const comboBonus = Math.floor(combo / 5) * 5;
  const addScore = ITEM_TYPES[food.type].score + comboBonus;
  score += addScore;
  updateBestScore();

  spawnFloatText(food.x, food.y, `+${addScore}`, food.type === "bonus" ? "#ff9f1c" : "#121826");
  if (food.type === "bonus" || combo % 5 === 0) {
    playBonusSound();
  } else {
    playCatchSound();
  }
}

function handleMiss(food) {
  if (food.type === "food") {
    combo = 0;
    life--;
    spawnFloatText(food.x, height - 72, "MISS", "#ff5f6d");
    playMissSound();
    if (life <= 0) {
      gameOver();
    }
  }
}

function getActiveFoodLimit() {
  return Math.min(
    selectedDifficulty.maxActiveFoods,
    START_FOOD_LIMIT + Math.floor(elapsedTime / EXTRA_FOOD_INTERVAL)
  );
}

function getSpeedGaugeState() {
  const level = Math.floor(elapsedTime / SPEED_LEVEL_INTERVAL) + 1;
  const progress = (elapsedTime % SPEED_LEVEL_INTERVAL) / SPEED_LEVEL_INTERVAL;

  return {
    level,
    progress
  };
}

function fillFoods() {
  const foodLimit = getActiveFoodLimit();

  while (foods.length < foodLimit) {
    spawnFood();
  }
}

function spawnFood() {
  const type = pickItemType();
  const item = ITEM_TYPES[type];
  const lane = pickLane();
  const laneWidth = width / selectedDifficulty.maxActiveFoods;
  const laneCenter = laneWidth * lane + laneWidth / 2;
  const xOffset = (Math.random() - 0.5) * Math.min(48, laneWidth * 0.45);
  const speedBonus = elapsedTime * SPEED_UP_PER_SECOND;
  const baseSpeed = BASE_FOOD_SPEED + speedBonus + Math.random() * RANDOM_FOOD_SPEED;

  foods.push({
    x: clamp(laneCenter + xOffset, 28, width - 28),
    y: -36 - Math.random() * 110,
    size: item.size,
    speed: baseSpeed * selectedDifficulty.speedMultiplier,
    image: getItemImage(type),
    type,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.2
  });
}

function pickItemType() {
  const roll = Math.random();

  if (roll < BOMB_CHANCE && elapsedTime > 8) return "bomb";
  if (roll < BOMB_CHANCE + LIFE_ITEM_CHANCE && life < MAX_LIFE) return "life";
  if (roll < BOMB_CHANCE + LIFE_ITEM_CHANCE + BONUS_ITEM_CHANCE) return "bonus";
  return "food";
}

function pickLane() {
  const laneCount = selectedDifficulty.maxActiveFoods;
  let lane = Math.floor(Math.random() * laneCount);

  if (lane === lastLane) {
    sameLaneCount++;
  } else {
    sameLaneCount = 0;
  }

  if (sameLaneCount >= 2) {
    lane = (lane + 1 + Math.floor(Math.random() * (laneCount - 1))) % laneCount;
    sameLaneCount = 0;
  }

  lastLane = lane;
  return lane;
}

function getItemImage(type) {
  if (type === "life") return lifeImage;
  if (type === "bomb") return bombImage;
  if (type === "bonus") return bonusImage;
  return foodImages[Math.floor(Math.random() * foodImages.length)];
}

function isHit(food) {
  const hitX = Math.abs(food.x - player.x) < player.width / 2 + food.size / 2;
  const hitY = Math.abs(food.y - player.y) < player.height / 2 + food.size / 2;
  return hitX && hitY;
}

function draw() {
  if (!width || !height) return;

  drawBackground();

  for (const food of foods) {
    drawItem(food);
  }

  drawParticles();
  drawCenteredImage(basketImage, player.x, player.y, player.width, player.height);
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#89d7ff");
  sky.addColorStop(0.48, "#e7fbff");
  sky.addColorStop(1, "#fff0b0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let y = 130; y < height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(width * 0.5, y + 16, width, y);
    ctx.stroke();
  }
  ctx.restore();

  drawCloud(width * 0.18, height * 0.18, 34);
  drawCloud(width * 0.78, height * 0.25, 26);

  ctx.fillStyle = "#7bd88f";
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, height - 56);
  ctx.quadraticCurveTo(width * 0.28, height - 96, width * 0.56, height - 58);
  ctx.quadraticCurveTo(width * 0.78, height - 30, width, height - 70);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
}

function drawCloud(x, y, size) {
  ctx.save();
  ctx.globalAlpha = 0.52;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
  ctx.arc(x + size * 0.6, y + 4, size * 0.56, 0, Math.PI * 2);
  ctx.arc(x - size * 0.65, y + 6, size * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawItem(food) {
  if (!food.image.complete || food.image.naturalWidth === 0) return;

  ctx.save();
  ctx.translate(food.x, food.y);
  ctx.rotate(food.rotation);

  if (food.type === "bonus" || food.type === "life") {
    ctx.shadowColor = food.type === "bonus" ? "rgba(255, 159, 28, 0.55)" : "rgba(46, 196, 182, 0.55)";
    ctx.shadowBlur = 18;
  }

  ctx.drawImage(food.image, -food.size / 2, -food.size / 2, food.size, food.size);
  ctx.restore();
}

function drawCenteredImage(image, x, y, drawWidth, drawHeight) {
  if (!image.complete || image.naturalWidth === 0) return;

  ctx.drawImage(
    image,
    x - drawWidth / 2,
    y - drawHeight / 2,
    drawWidth,
    drawHeight
  );
}

function spawnFloatText(x, y, text, color) {
  particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 40,
    vy: -95 - Math.random() * 40,
    age: 0,
    life: 0.8,
    text,
    color
  });
}

function drawParticles() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "900 18px Segoe UI, sans-serif";

  for (const particle of particles) {
    const progress = particle.age / particle.life;
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = particle.color;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
    ctx.lineWidth = 4;
    ctx.strokeText(particle.text, particle.x, particle.y);
    ctx.fillText(particle.text, particle.x, particle.y);
  }

  ctx.restore();
}

function getAdPlaceholderHtml() {
  return `
    <div class="ad-placeholder" aria-label="広告枠">
      <span>AD SPACE</span>
    </div>
  `;
}

function showDifficultyScreen() {
  isPlaying = false;
  message.classList.remove("hidden");
  message.innerHTML = `
    <h1 class="screen-title">ルールと難易度</h1>
    <p class="screen-subtitle">フードをキャッチしてスコアアップ。危険アイテムを避けながら、コンボを伸ばしてください。</p>
    <div class="rules-grid">
      <div class="rule-card"><strong>フード</strong><span>キャッチで+10。取り逃すとLifeが1減ります。</span></div>
      <div class="rule-card"><strong>ゴールド</strong><span>キャッチで+35。コンボ中は追加点も入ります。</span></div>
      <div class="rule-card"><strong>ハート</strong><span>Lifeが1回復。取り逃してもペナルティなし。</span></div>
      <div class="rule-card"><strong>ボム</strong><span>当たるとLife-1。避ければ問題ありません。</span></div>
    </div>
    <div class="difficulty-options">
      ${Object.entries(DIFFICULTIES).map(([key, difficulty]) => `
        <button class="difficulty-button" data-difficulty="${key}">
          <b>${difficulty.label}</b>
          <small>${difficulty.summary}</small>
        </button>
      `).join("")}
    </div>
    <button id="backToTitleButton" class="secondary-button">TITLE</button>
  `;

  document.querySelectorAll(".difficulty-button").forEach((button) => {
    button.addEventListener("click", () => {
      startGame(DIFFICULTIES[button.dataset.difficulty]);
    });
  });
  document.getElementById("backToTitleButton").addEventListener("click", showTitleScreen);
}

function gameOver() {
  isPlaying = false;
  updateBestScore();
  updateUI();
  message.classList.remove("hidden");
  message.innerHTML = `
    <h1 class="screen-title">Game Over</h1>
    <p class="screen-subtitle">今回の結果です。コンボを伸ばすほど、次のスコアが跳ねやすくなります。</p>
    <div class="result-grid">
      <div class="result-card"><strong>Score</strong><span>${score}</span></div>
      <div class="result-card"><strong>Best</strong><span>${bestScore}</span></div>
      <div class="result-card"><strong>Difficulty</strong><span>${selectedDifficulty.label}</span></div>
      <div class="result-card"><strong>Max Combo</strong><span>${maxCombo}</span></div>
    </div>
    <div class="button-row">
      <button id="restartButton">RETRY</button>
      <button id="titleButton" class="secondary-button">TITLE</button>
    </div>
    ${getAdPlaceholderHtml()}
  `;

  document.getElementById("restartButton").addEventListener("click", () => startGame(selectedDifficulty));
  document.getElementById("titleButton").addEventListener("click", showTitleScreen);
}

function showTitleScreen() {
  isPlaying = false;
  foods.length = 0;
  particles.length = 0;
  score = 0;
  combo = 0;
  life = MAX_LIFE;
  elapsedTime = 0;
  updateUI();
  draw();

  message.classList.remove("hidden");
  message.innerHTML = `
    <img class="title-logo" src="assets/logo.svg" alt="Food Catch!" />
    <img class="title-character" src="assets/mascot.svg" alt="カゴのキャラクター" />
    <p class="title-best">Best <span id="titleBestScoreText">${bestScore}</span></p>
    <p class="title-copy">フードを集めてコンボをつなぐ、カジュアルキャッチアクション。</p>
    <button id="startButton">START</button>
    ${getAdPlaceholderHtml()}
  `;
  document.getElementById("startButton").addEventListener("click", showDifficultyScreen);
}

function updateUI() {
  scoreText.textContent = score;
  bestScoreText.textContent = bestScore;
  lifeText.textContent = "❤".repeat(life).padEnd(MAX_LIFE, "♡");
  comboText.textContent = combo;
  timeText.textContent = Math.floor(elapsedTime);

  const speedGaugeState = getSpeedGaugeState();
  speedGaugeLabel.textContent = "Speed Lv";
  speedGaugeValue.textContent = speedGaugeState.level;
  speedGaugeFill.style.width = `${speedGaugeState.progress * 100}%`;
  speedGauge.classList.remove("is-max");

  const currentTitleBestScoreText = document.getElementById("titleBestScoreText");
  if (currentTitleBestScoreText) {
    currentTitleBestScoreText.textContent = bestScore;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
});

gameWrap.addEventListener("pointermove", (e) => {
  if (!isPlaying) return;

  const rect = gameWrap.getBoundingClientRect();
  player.x = clamp(e.clientX - rect.left, player.width / 2, width - player.width / 2);
});

message.addEventListener("click", (e) => {
  if (e.target.id === "startButton") {
    showDifficultyScreen();
  }
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
updateUI();
draw();
