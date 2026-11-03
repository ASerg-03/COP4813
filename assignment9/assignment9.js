// Canvas setup
const canvas = document.getElementById("physicsCanvas");
const ctx = canvas.getContext("2d");

const gravityButton = document.getElementById("gravityButton");
const spawnButton = document.getElementById("spawnButton");
const resetButton = document.getElementById("resetButton");
const statusMessage = document.getElementById("statusMessage");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const GRAVITY = 850;
const BOUNCE = 0.78;
const MAX_THROW_SPEED = 1400;

const colors = [
    "#5eead4",
    "#fbbf24",
    "#fb7185",
    "#60a5fa",
    "#c084fc",
    "#a3e635"
];

let balls = [];
let gravityEnabled = true;
let dragging = null;
let lastTimestamp = 0;


function createBall(x, y, vx, vy, radius, color) {
    return {
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        radius: radius,
        color: color
    };
}


function spawnBall() {
    const radius = 14 + Math.random() * 10;

    const x = radius + Math.random() * (WIDTH - radius * 2);
    const y = radius + Math.random() * (HEIGHT * 0.4);

    const direction = Math.random() < 0.5 ? -1 : 1;
    const vx = direction * (100 + Math.random() * 170);
    const vy = (Math.random() - 0.5) * 240;

    const color = colors[Math.floor(Math.random() * colors.length)];

    balls.push(createBall(x, y, vx, vy, radius, color));

    updateStatus();
}


function resetSandbox() {
    balls = [];

    gravityEnabled = true;
    dragging = null;

    balls.push(
        createBall(150, 100, 210, 100, 22, "#5eead4")
    );

    updateGravityButton();
    updateStatus();
}


function updateGravityButton() {
    gravityButton.textContent =
        gravityEnabled ? "Gravity: ON" : "Gravity: OFF";

    gravityButton.setAttribute(
        "aria-pressed",
        String(gravityEnabled)
    );
}


function updateStatus() {
    statusMessage.textContent =
        `Balls: ${balls.length} | Gravity: ${gravityEnabled ? "ON" : "OFF"}`;
}


function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}


function getPointerPosition(event) {
    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * WIDTH / rect.width,
        y: (event.clientY - rect.top) * HEIGHT / rect.height
    };
}


function findBallAt(x, y) {
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];

        const dx = x - ball.x;
        const dy = y - ball.y;

        if (dx * dx + dy * dy <= ball.radius * ball.radius) {
            return ball;
        }
    }

    return null;
}


function updateBall(ball, deltaTime) {
    if (dragging && dragging.ball === ball) {
        return;
    }

    if (gravityEnabled) {
        ball.vy += GRAVITY * deltaTime;
    }

    // Update position using velocity.
    ball.x += ball.vx * deltaTime;
    ball.y += ball.vy * deltaTime;

    // Left wall
    if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx) * BOUNCE;
    }

    if (ball.x + ball.radius > WIDTH) {
        ball.x = WIDTH - ball.radius;
        ball.vx = -Math.abs(ball.vx) * BOUNCE;
    }

    if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy) * BOUNCE;
    }

    if (ball.y + ball.radius > HEIGHT) {
        ball.y = HEIGHT - ball.radius;

        if (Math.abs(ball.vy) < 45) {
            ball.vy = 0;
        } else {
            ball.vy = -Math.abs(ball.vy) * BOUNCE;
        }

        ball.vx *= Math.pow(0.985, deltaTime * 60);

        if (Math.abs(ball.vx) < 5) {
            ball.vx = 0;
        }
    }
}


function drawBackground() {
    ctx.fillStyle = "#0b1118";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = "rgba(100, 160, 140, 0.12)";
    ctx.lineWidth = 1;

    for (let x = 40; x < WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
    }

    for (let y = 40; y < HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
    }
}


function drawBall(ball) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);

    ctx.fillStyle = ball.color;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#e2e8f0";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
        ball.x - ball.radius * 0.3,
        ball.y - ball.radius * 0.3,
        ball.radius * 0.22,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.fill();
}


function drawScene() {
    drawBackground();

    for (const ball of balls) {
        drawBall(ball);
    }
}


function animate(timestamp) {
    let deltaTime = 0;

    if (lastTimestamp !== 0) {
        deltaTime = (timestamp - lastTimestamp) / 1000;

        deltaTime = Math.min(deltaTime, 0.03);
    }

    lastTimestamp = timestamp;

    for (const ball of balls) {
        updateBall(ball, deltaTime);
    }

    drawScene();

    requestAnimationFrame(animate);
}


canvas.addEventListener("pointerdown", function (event) {
    const pointer = getPointerPosition(event);
    const ball = findBallAt(pointer.x, pointer.y);

    if (!ball) {
        return;
    }

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    ball.vx = 0;
    ball.vy = 0;

    dragging = {
        ball: ball,
        pointerId: event.pointerId,

        offsetX: pointer.x - ball.x,
        offsetY: pointer.y - ball.y,

        startX: pointer.x,
        startY: pointer.y,
        moved: false,

        samples: [{
            x: pointer.x,
            y: pointer.y,
            time: performance.now()
        }]
    };
});


canvas.addEventListener("pointermove", function (event) {
    if (!dragging || dragging.pointerId !== event.pointerId) {
        return;
    }

    const pointer = getPointerPosition(event);
    const drag = dragging;
    const ball = drag.ball;

    const dx = pointer.x - drag.startX;
    const dy = pointer.y - drag.startY;

    if (Math.hypot(dx, dy) > 5) {
        drag.moved = true;
    }

    ball.x = clamp(
        pointer.x - drag.offsetX,
        ball.radius,
        WIDTH - ball.radius
    );

    ball.y = clamp(
        pointer.y - drag.offsetY,
        ball.radius,
        HEIGHT - ball.radius
    );

    const now = performance.now();

    drag.samples.push({
        x: pointer.x,
        y: pointer.y,
        time: now
    });

    while (
        drag.samples.length > 2 &&
        now - drag.samples[0].time > 120
    ) {
        drag.samples.shift();
    }
});


function finishDrag(event) {
    if (!dragging || dragging.pointerId !== event.pointerId) {
        return;
    }

    const drag = dragging;
    const pointer = getPointerPosition(event);
    const ball = drag.ball;
    const now = performance.now();

    ball.x = clamp(
        pointer.x - drag.offsetX,
        ball.radius,
        WIDTH - ball.radius
    );

    ball.y = clamp(
        pointer.y - drag.offsetY,
        ball.radius,
        HEIGHT - ball.radius
    );

    const dx = pointer.x - drag.startX;
    const dy = pointer.y - drag.startY;

    if (Math.hypot(dx, dy) > 5) {
        drag.moved = true;
    }

    drag.samples.push({
        x: pointer.x,
        y: pointer.y,
        time: now
    });

    while (
        drag.samples.length > 2 &&
        now - drag.samples[0].time > 120
    ) {
        drag.samples.shift();
    }

    if (drag.moved) {
        const first = drag.samples[0];
        const last = drag.samples[drag.samples.length - 1];

        const elapsed = Math.max(
            (last.time - first.time) / 1000,
            0.016
        );

        ball.vx = (last.x - first.x) / elapsed;
        ball.vy = (last.y - first.y) / elapsed;

        const speed = Math.hypot(ball.vx, ball.vy);

        if (speed > MAX_THROW_SPEED) {
            const scale = MAX_THROW_SPEED / speed;

            ball.vx *= scale;
            ball.vy *= scale;
        }
    } else {
        ball.vx = 0;
        ball.vy = 0;
    }

    dragging = null;
}

canvas.addEventListener("pointerup", finishDrag);
canvas.addEventListener("pointercancel", finishDrag);


gravityButton.addEventListener("click", function () {
    gravityEnabled = !gravityEnabled;

    updateGravityButton();
    updateStatus();
});

spawnButton.addEventListener("click", spawnBall);
resetButton.addEventListener("click", resetSandbox);


// Initialize the sandbox and start animation.
resetSandbox();
requestAnimationFrame(animate);