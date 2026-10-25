const symbols = [
    '🍒', '🍋', '⭐', '🔔', '🍉', '7️⃣',
    '🍇', '🍀', '💎', '🍊', '🃏', '💰'
];
const reels = Array.from(document.querySelectorAll('.reel'));
const spinButton = document.getElementById('spinButton');
const stopButton = document.getElementById('stopButton');
const leverButton = document.getElementById('machineLever');
const betInput = document.getElementById('betAmount');
const resultDiv = document.getElementById('result');
const reelTimers = [];
let stoppedReels = 0;
let isSpinning = false;
let isStarting = false;
let currentWager = 0;

async function spinSlots() {
    if (isSpinning || isStarting) return;

    const maximumBet = Math.floor(Number.MAX_SAFE_INTEGER / 50);
    const requestedBet = Number(betInput.value);
    if (!Number.isSafeInteger(requestedBet) || requestedBet < 1 || requestedBet > maximumBet) {
        window.CasinoApp.notify(`Zadejte sázku od 1 do ${maximumBet.toLocaleString('cs-CZ')} kreditů.`);
        return;
    }

    isStarting = true;
    spinButton.disabled = true;
    stopButton.disabled = true;
    betInput.disabled = true;
    if (leverButton) {
        leverButton.disabled = true;
        leverButton.setAttribute('aria-label', 'Automat se spouští');
    }
    let wager;
    try {
        wager = await window.CasinoApp.getWager('betAmount');
    } catch (error) {
        console.error('Nepodařilo se spustit automat.', error);
        window.CasinoApp.notify(error.message || 'Automat se nepodařilo spustit. Zkus to znovu.');
        wager = null;
    }
    isStarting = false;
    if (wager === null) {
        spinButton.disabled = false;
        betInput.disabled = false;
        if (leverButton) {
            leverButton.disabled = false;
            leverButton.setAttribute('aria-label', 'Roztočit válce');
        }
        return;
    }

    currentWager = wager;
    isSpinning = true;
    stoppedReels = 0;
    resultDiv.textContent = 'Zastavte válce postupně tlačítkem „Zastavit válec“.';
    stopButton.disabled = false;
    if (leverButton) {
        leverButton.disabled = false;
        leverButton.setAttribute('aria-label', 'Zastavit další válec');
    }

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
    if (leverButton) {
        leverButton.setAttribute(
            'aria-label',
            stoppedReels === reels.length ? 'Výsledek se zpracovává' : 'Zastavit další válec'
        );
    }

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
        let credited = payout === 0;
        try {
            if (payout > 0) credited = await window.CasinoApp.payout(payout);
        } catch (error) {
            console.error('Nepodařilo se připsat výhru z automatu.', error);
            window.CasinoApp.notify(error.message || 'Výhru se nepodařilo připsat.');
        }
        resultDiv.textContent = payout > 0 && credited
            ? `Výsledek: ${result.join(' | ')} — výhra ${payout} kreditů (${multiplier}×)!`
            : payout > 0
                ? `Výsledek: ${result.join(' | ')} — výhru ${payout} kreditů se nepodařilo připsat.`
                : `Výsledek: ${result.join(' | ')} — tentokrát bez výhry.`;
        stopButton.disabled = true;
        spinButton.disabled = false;
        isSpinning = false;
        betInput.disabled = false;
        if (leverButton) leverButton.setAttribute('aria-label', 'Roztočit válce');
    } else {
        resultDiv.textContent = `Zastaveno ${stoppedReels} z ${reels.length} válců. Zastavte další.`;
    }
}