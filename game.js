const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gameWrap = document.getElementById("gameWrap");
const scoreText = document.getElementById("scoreText");
const lifeText = document.getElementById("lifeText");
const message = document.getElementById("message");
const startButton = document.getElementById("startButton");

let width;
let height;

let score = 0;
let life = 3;
let isPlaying = false;
let lastTime = 0;
let spawnTimer = 0;

const player = {
  x: 0,
  y: 0,
  width: 90,
  height: 40,
  speed: 420
};

const foods = [];
const foodIcons = ["🍎", "🍙", "🍔", "🍓", "🥕"];

const keys = {
  left: false,
  right: false
};

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
  score = 0;
  life = 3;
  foods.length = 0;
  spawnTimer = 0;
  isPlaying = true;

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
  if (keys.left) player.x -= player.speed * deltaTime;
  if (keys.right) player.x += player.speed * deltaTime;

  player.x = Math.max(player.width / 2, Math.min(width - player.width / 2, player.x));

  spawnTimer += deltaTime;
  if (spawnTimer >= 1) {
    spawnTimer = 0;
    spawnFood();
  }

  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    food.y += food.speed * deltaTime;

    if (isHit(food)) {
      foods.splice(i, 1);
      score += 10;
      updateUI();
      continue;
    }

    if (food.y > height + 40) {
      foods.splice(i, 1);
      life--;
      updateUI();

      if (life <= 0) {
        gameOver();
      }
    }
  }
}

function spawnFood() {
  foods.push({
    x: 30 + Math.random() * (width - 60),
    y: -30,
    size: 40,
    speed: 180 + Math.random() * 120,
    icon: foodIcons[Math.floor(Math.random() * foodIcons.length)]
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
    ctx.font = `${food.size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(food.icon, food.x, food.y);
  }

  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(
    player.x - player.width / 2,
    player.y - player.height / 2,
    player.width,
    player.height
  );

  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🧺", player.x, player.y);
}

function gameOver() {
  isPlaying = false;
  message.classList.remove("hidden");
  message.innerHTML = `
    <h1>Game Over</h1>
    <p>Score: ${score}</p>
    <button id="restartButton">RETRY</button>
  `;

  document.getElementById("restartButton").addEventListener("click", startGame);
}

function updateUI() {
  scoreText.textContent = score;
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
draw();