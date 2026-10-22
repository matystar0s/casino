const dieElements = [document.getElementById('dieOne'), document.getElementById('dieTwo')];
const dieFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const rollButton = document.getElementById('rollButton');
const diceResult = document.getElementById('result');

function rollDice() {
    if (rollButton.disabled) return;
    const wager = window.CasinoApp.getWager('betAmount');
    if (wager === null) return;

    rollButton.disabled = true;
    document.getElementById('prediction').disabled = true;
    document.getElementById('betAmount').disabled = true;
    dieElements.forEach((die) => die.classList.add('rolling'));
    diceResult.textContent = 'Kostky se kutálejí…';

    window.setTimeout(() => {
        const first = Math.floor(Math.random() * 6) + 1;
        const second = Math.floor(Math.random() * 6) + 1;
        const sum = first + second;
        const prediction = document.getElementById('prediction').value;
        const wins = prediction === 'high' ? sum > 7 : prediction === 'low' ? sum < 7 : sum === 7;
        const payout = wins ? wager * (prediction === 'seven' ? 5 : 2) : 0;

        dieElements.forEach((die) => die.classList.remove('rolling'));
        dieElements[0].textContent = dieFaces[first - 1];
        dieElements[1].textContent = dieFaces[second - 1];
        dieElements[0].setAttribute('aria-label', `První kostka: ${first}`);
        dieElements[1].setAttribute('aria-label', `Druhá kostka: ${second}`);
        const credited = payout === 0 || window.CasinoApp.payout(payout);
        diceResult.textContent = payout > 0 && credited
            ? `Padlo ${first} + ${second} = ${sum}. Vyhráli jste ${payout} kreditů!`
            : payout > 0
                ? `Padlo ${first} + ${second} = ${sum}. Výhru ${payout} kreditů se nepodařilo připsat.`
                : `Padlo ${first} + ${second} = ${sum}. Tentokrát bez výhry.`;
        document.getElementById('prediction').disabled = false;
        document.getElementById('betAmount').disabled = false;
        rollButton.disabled = false;
    }, 1100);
}
