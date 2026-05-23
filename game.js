const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gameWrap = document.getElementById("gameWrap");
const scoreText = document.getElementById("scoreText");
const bestScoreText = document.getElementById("bestScoreText");
const titleBestScoreText = document.getElementById("titleBestScoreText");
const lifeText = document.getElementById("lifeText");
const message = document.getElementById("message");
const startButton = document.getElementById("startButton");

const BEST_SCORE_KEY = "foodCatchGameBestScore";
const BASE_FOOD_SPEED = 180;
const RANDOM_FOOD_SPEED = 120;
const SPEED_UP_PER_SECOND = 14;
const MAX_FOOD_SPEED_BONUS = 760;
const START_FOOD_LIMIT = 1;
const EXTRA_FOOD_INTERVAL = 10;
const MAX_ACTIVE_FOODS = 4;

let width;
let height;

let score = 0;
let bestScore = loadBestScore();
let life = 3;
let isPlaying = false;
let lastTime = 0;
let elapsedTime = 0;
let audioContext = null;

const player = {
  x: 0,
  y: 0,
  width: 90,
  height: 40,
  speed: 420
};

const foods = [];
const foodImages = [
  loadGameImage("assets/apple.svg"),
  loadGameImage("assets/rice-ball.svg"),
  loadGameImage("assets/burger.svg"),
  loadGameImage("assets/strawberry.svg"),
  loadGameImage("assets/carrot.svg")
];
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

  player.x = width / 2;
  player.y = height - 80;
}

function startGame() {
  getAudioContext();

  score = 0;
  life = 3;
  foods.length = 0;
  elapsedTime = 0;
  isPlaying = true;
  fillFoods();

  updateUI();
  message.classList.add("hidden");

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function gameLoop(time) {
  if (!isPlaying) return;

  const deltaTime = (time - lastTime) / 1000;
  lastTime = time;

  update(deltaTime);
  draw();

  requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
  elapsedTime += deltaTime;

  if (keys.left) player.x -= player.speed * deltaTime;
  if (keys.right) player.x += player.speed * deltaTime;

  player.x = Math.max(player.width / 2, Math.min(width - player.width / 2, player.x));

  fillFoods();

  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    food.y += food.speed * deltaTime;

    if (isHit(food)) {
      foods.splice(i, 1);
      score += 10;
      playCatchSound();
      updateBestScore();
      updateUI();
      continue;
    }

    if (food.y > height + 40) {
      foods.splice(i, 1);
      playMissSound();
      life--;
      updateUI();

      if (life <= 0) {
        gameOver();
      }
    }
  }
}

function getActiveFoodLimit() {
  return Math.min(
    MAX_ACTIVE_FOODS,
    START_FOOD_LIMIT + Math.floor(elapsedTime / EXTRA_FOOD_INTERVAL)
  );
}

function fillFoods() {
  const foodLimit = getActiveFoodLimit();

  while (foods.length < foodLimit) {
    spawnFood();
  }
}

function spawnFood() {
  const speedBonus = Math.min(elapsedTime * SPEED_UP_PER_SECOND, MAX_FOOD_SPEED_BONUS);

  foods.push({
    x: 30 + Math.random() * (width - 60),
    y: -30 - Math.random() * 80,
    size: 40,
    speed: BASE_FOOD_SPEED + speedBonus + Math.random() * RANDOM_FOOD_SPEED,
    image: foodImages[Math.floor(Math.random() * foodImages.length)]
  });
}

function isHit(food) {
  const hitX = Math.abs(food.x - player.x) < player.width / 2 + food.size / 2;
  const hitY = Math.abs(food.y - player.y) < player.height / 2 + food.size / 2;
  return hitX && hitY;
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  for (const food of foods) {
    drawCenteredImage(food.image, food.x, food.y, food.size, food.size);
  }

  drawCenteredImage(basketImage, player.x, player.y, player.width, player.height);
}

function drawCenteredImage(image, x, y, drawWidth, drawHeight) {
  if (!image.complete || image.naturalWidth === 0) {
    return;
  }

  ctx.drawImage(
    image,
    x - drawWidth / 2,
    y - drawHeight / 2,
    drawWidth,
    drawHeight
  );
}

function gameOver() {
  isPlaying = false;
  updateBestScore();
  updateUI();
  message.classList.remove("hidden");
  message.innerHTML = `
    <h1>Game Over</h1>
    <p>Score: ${score}</p>
    <p>Best: ${bestScore}</p>
    <button id="restartButton">RETRY</button>
  `;

  document.getElementById("restartButton").addEventListener("click", startGame);
}

function updateUI() {
  scoreText.textContent = score;
  bestScoreText.textContent = bestScore;
  titleBestScoreText.textContent = bestScore;
  lifeText.textContent = life;
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
  player.x = e.clientX - rect.left;
});

startButton.addEventListener("click", startGame);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
updateUI();
draw();
