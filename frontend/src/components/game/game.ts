// frontend/src/game.ts
// Exposes initGame(canvas) and start/stop control

type Paddle = { x: number; y: number };
type Ball = { x: number; y: number; vx: number; vy: number; r: number };

export function initGame(canvasId = "game") {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) throw new Error("Canvas not found");
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;

  const paddleW = 10;
  const paddleH = 80;
  const speed = 6;

  const p1: Paddle = { x: 10, y: h / 2 - paddleH / 2 };
  const p2: Paddle = { x: w - 10 - paddleW, y: h / 2 - paddleH / 2 };
  const ball: Ball = { x: w / 2, y: h / 2, vx: 4, vy: 2, r: 7 };

  const keys: Record<string, boolean> = {};
  window.addEventListener("keydown", (e) => {
    // Don't capture keys when user is typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    keys[e.key] = true;
  });
  window.addEventListener("keyup", (e) => {
    // Don't capture keys when user is typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    keys[e.key] = false;
  });

  function resetBall() {
    ball.x = w / 2;
    ball.y = h / 2;
    ball.vx = Math.random() > 0.5 ? 4 : -4;
    ball.vy = Math.random() * 4 - 2;
  }

  function update() {
    if (keys["w"] || keys["W"]) p1.y -= speed;
    if (keys["s"] || keys["S"]) p1.y += speed;
    if (keys["ArrowUp"]) p2.y -= speed;
    if (keys["ArrowDown"]) p2.y += speed;

    p1.y = Math.max(0, Math.min(h - paddleH, p1.y));
    p2.y = Math.max(0, Math.min(h - paddleH, p2.y));

    ball.x += ball.vx;
    ball.y += ball.vy;
    if (ball.y - ball.r < 0 || ball.y + ball.r > h) ball.vy *= -1;

    if (ball.x - ball.r < p1.x + paddleW) {
      if (ball.y > p1.y && ball.y < p1.y + paddleH) ball.vx = Math.abs(ball.vx) + 0.5;
    }
    if (ball.x + ball.r > p2.x) {
      if (ball.y > p2.y && ball.y < p2.y + paddleH) ball.vx = -Math.abs(ball.vx) - 0.5;
    }

    if (ball.x < 0 || ball.x > w) resetBall();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    for (let y = 0; y < h; y += 20) ctx.fillRect(w / 2 - 1, y, 2, 10);
    ctx.fillRect(p1.x, p1.y, paddleW, paddleH);
    ctx.fillRect(p2.x, p2.y, paddleW, paddleH);
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }

  let raf = 0;
  function loop() {
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  return {
    start() {
      if (!raf) loop();
    },
    stop() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    // For tests / external usage expose a minimal state snapshot
    snapshot() {
      return {
        p1: { ...p1 },
        p2: { ...p2 },
        ball: { ...ball },
      };
    },
  };
}