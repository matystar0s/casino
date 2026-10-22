const coin = document.getElementById('coin');
const flipButton = document.getElementById('flipButton');
const coinResult = document.getElementById('result');

async function flipCoin() {
    if (flipButton.disabled) return;
    const wager = await window.CasinoApp.getWager('betAmount');
    if (wager === null) return;

    flipButton.disabled = true;
    document.getElementById('prediction').disabled = true;
    document.getElementById('betAmount').disabled = true;
    coin.classList.remove('flipping');
    void coin.offsetWidth;
    coin.classList.add('flipping');
    coinResult.textContent = 'Mince se točí…';

    window.setTimeout(async () => {
        const result = Math.random() < 0.5 ? 'orel' : 'panna';
        const wins = document.getElementById('prediction').value === result;
        const payout = wins ? wager * 2 : 0;
        coin.classList.remove('flipping');
        coin.textContent = result === 'orel' ? 'Orel' : 'Panna';
        coin.setAttribute('aria-label', `Padl ${result}`);
        const credited = payout === 0 || await window.CasinoApp.payout(payout);
        coinResult.textContent = payout > 0 && credited
            ? `Padl ${result}. Vyhráli jste ${payout} kreditů!`
            : payout > 0
                ? `Padl ${result}. Výhru ${payout} kreditů se nepodařilo připsat.`
                : `Padl ${result}. Tentokrát bez výhry.`;
        document.getElementById('prediction').disabled = false;
        document.getElementById('betAmount').disabled = false;
        flipButton.disabled = false;
    }, 1400);
}
