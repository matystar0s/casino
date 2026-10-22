const rouletteNumbers = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
const redNumbers = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);
const wheel = document.getElementById('wheel');
const wheelNumbers = document.getElementById('wheelNumbers');
const ballTrack = document.getElementById('ballTrack');
const resultDiv = document.getElementById('result');
const spinButton = document.getElementById('spinButton');
const segmentAngle = 360 / rouletteNumbers.length;
let wheelRotation = 0;

wheel.style.background = `conic-gradient(from ${-segmentAngle / 2}deg, ${rouletteNumbers
    .map((number, index) => {
        const color = number === 0 ? '#168a55' : redNumbers.has(number) ? '#b52d3a' : '#202326';
        return `${color} ${index * segmentAngle}deg ${(index + 1) * segmentAngle}deg`;
    })
    .join(', ')})`;

rouletteNumbers.forEach((number, index) => {
    const label = document.createElement('span');
    const angle = index * segmentAngle;
    label.className = 'wheel-number';
    label.textContent = number;
    label.style.transform = `rotate(${angle}deg) translateY(-${wheel.clientWidth * 0.39}px) rotate(${-angle}deg)`;
    wheelNumbers.appendChild(label);
});

function spinWheel() {
    if (spinButton.disabled) return;

    const wager = window.CasinoApp.getWager('betAmount');
    if (wager === null) return;

    const winningIndex = Math.floor(Math.random() * rouletteNumbers.length);
    const number = rouletteNumbers[winningIndex];
    const color = number === 0 ? 'zelené' : redNumbers.has(number) ? 'červené' : 'černé';
    const colorKey = number === 0 ? 'green' : redNumbers.has(number) ? 'red' : 'black';
    const betColor = document.getElementById('betColor').value;
    const payout = betColor === colorKey ? wager * (colorKey === 'green' ? 36 : 2) : 0;
    const landingRotation = (360 - winningIndex * segmentAngle) % 360;
    const rotationToLanding = (landingRotation - (wheelRotation % 360) + 360) % 360;
    const spinDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : 4200;

    spinButton.disabled = true;
    resultDiv.textContent = 'Kulička se točí...';
    wheel.classList.remove('spinning');
    ballTrack.classList.remove('spinning');
    wheel.style.transition = 'none';
    wheel.style.transform = `rotate(${wheelRotation}deg)`;
    void wheel.offsetWidth;
    wheel.style.transition = '';
    wheelRotation += 1440 + rotationToLanding;
    wheel.classList.add('spinning');
    wheel.style.transform = `rotate(${wheelRotation}deg)`;
    ballTrack.classList.add('spinning');

    window.setTimeout(() => {
        wheel.classList.remove('spinning');
        ballTrack.classList.remove('spinning');
        const credited = payout === 0 || window.CasinoApp.payout(payout);
        resultDiv.textContent = payout > 0 && credited
            ? `Ruleta se zastavila na čísle ${number} (${color}). Vyhráli jste ${payout} kreditů!`
            : payout > 0
                ? `Ruleta se zastavila na čísle ${number} (${color}). Výhru ${payout} kreditů se nepodařilo připsat.`
                : `Ruleta se zastavila na čísle ${number} (${color}). Tentokrát bez výhry.`;
        spinButton.disabled = false;
    }, spinDuration);
}