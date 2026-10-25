const symbols = [
    '🍒', '🍋', '⭐', '🔔', '🍉', '7️⃣',
    '🍇', '🍀', '💎', '🍊', '🃏', '💰'
];
const reels = Array.from(document.querySelectorAll('.reel'));
const spinButton = document.getElementById('spinButton');
const stopButton = document.getElementById('stopButton');
const resultDiv = document.getElementById('result');
const reelTimers = [];
let stoppedReels = 0;
let isSpinning = false;
let currentWager = 0;

async function spinSlots() {
    if (isSpinning) return;

    const wager = await window.CasinoApp.getWager('betAmount');
    if (wager === null) return;

    currentWager = wager;
    isSpinning = true;
    stoppedReels = 0;
    document.getElementById('betAmount').disabled = true;
    resultDiv.textContent = 'Zastavte válce postupně tlačítkem „Zastavit válec“.';
    spinButton.disabled = true;
    stopButton.disabled = false;

    reels.forEach((reel, index) => {
        const symbol = reel.querySelector('.reel-symbol');
        reel.classList.add('spinning');
        symbol.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        reelTimers[index] = window.setInterval(() => {
            symbol.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        }, 100);
    });
}

async function stopSlot() {
    if (!isSpinning || stoppedReels >= reels.length) return;

    const reel = reels[stoppedReels];
    window.clearInterval(reelTimers[stoppedReels]);
    reel.classList.remove('spinning');
    reel.querySelector('.reel-symbol').textContent =
        symbols[Math.floor(Math.random() * symbols.length)];
    stoppedReels += 1;

    if (stoppedReels === reels.length) {
        const result = reels.map((item) => item.querySelector('.reel-symbol').textContent);
        const counts = new Map();
        result.forEach((symbol) => counts.set(symbol, (counts.get(symbol) || 0) + 1));
        const matchingCount = Math.max(...counts.values());
        const matchingSymbol = [...counts.entries()]
            .find(([, count]) => count === matchingCount)?.[0];
        const multiplier = matchingCount === 5
            ? matchingSymbol === '⭐' ? 50 : 25
            : matchingCount === 4 ? 8
                : matchingCount === 3 ? 3 : 0;
        const payout = currentWager * multiplier;
        const credited = payout === 0 || await window.CasinoApp.payout(payout);
        resultDiv.textContent = payout > 0 && credited
            ? `Výsledek: ${result.join(' | ')} — výhra ${payout} kreditů (${multiplier}×)!`
            : payout > 0
                ? `Výsledek: ${result.join(' | ')} — výhru ${payout} kreditů se nepodařilo připsat.`
                : `Výsledek: ${result.join(' | ')} — tentokrát bez výhry.`;
        stopButton.disabled = true;
        spinButton.disabled = false;
        isSpinning = false;
        document.getElementById('betAmount').disabled = false;
    } else {
        resultDiv.textContent = `Zastaveno ${stoppedReels} z ${reels.length} válců. Zastavte další.`;
    }
}