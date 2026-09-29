const canvas = document.getElementById("spirographCanvas");
const ctx = canvas.getContext("2d");

const radiusRInput = document.getElementById("radiusR");
const radiusR2Input = document.getElementById("radiusR2");
const offsetOInput = document.getElementById("offsetO");

const startButton = document.getElementById("startButton");

let drawing = false

startButton.addEventListener("click", function() {

    const R = Number(radiusRInput.value);
    const r = Number(radiusR2Input.value);
    const O = Number(offsetOInput.value);

    if (R <= 0 || r <= 0 || O < 0 || !Number.isInteger(R) || !Number.isInteger(r)) {
    alert("Please enter valid values. R and r must be positive whole numbers, and O cannot be negative.");
    return;
    }

    if (r > R) {
        alert("The inner radius (r) cannot be greater than the outer radius (R).");
        return;
    }

    const gcd = (a, b) => {
        while (b !== 0) {
            const temp = b;
            b = a % b;
            a = temp;
        }

        return a;
    };

    const commonDivisor = gcd(R, r);
    const rotations = r / commonDivisor;
    const maxT = 2 * Math.PI * rotations;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Move the drawing origin to the center of the canvas
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Start t at 0
    let  t = 0;

    // Calculate the first x and y positions
    let x = (R + r) * Math.cos(t) - (r + O) * Math.cos(((R + r) / r) * t);

    let y = (R + r) * Math.sin(t) - (r + O) * Math.sin(((R + r) / r) * t);

        
    ctx.beginPath();

    ctx.moveTo(x, y);

    function draw() {

        t += 0.02;

        x = (R + r) * Math.cos(t)
            - (r + O) * Math.cos(((R + r) / r) * t);

        y = (R + r) * Math.sin(t)
            - (r + O) * Math.sin(((R + r) / r) * t);

        ctx.lineTo(x, y);
        ctx.stroke();

        if (drawing && t < maxT) {
            requestAnimationFrame(draw);
        } else {
            ctx.closePath();
            ctx.restore();
        }
    }

    drawing = true;
    draw();
});


const stopButton = document.getElementById("stopButton");

stopButton.addEventListener("click", function() {
    drawing = false;
});