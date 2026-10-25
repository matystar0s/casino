(() => {
    const MAX_MULTIPLIER = 30;
    const GROWTH_RATE = 0.12;
    const betInput = document.getElementById('rocketBet');
    const startButton = document.getElementById('rocketStart');
    const cashoutButton = document.getElementById('rocketCashout');
    const multiplierDisplay = document.getElementById('rocketMultiplier');
    const statusDisplay = document.getElementById('rocketStatus');
    const messageDisplay = document.getElementById('rocketRoundMessage');
    const history = document.getElementById('rocketHistory');
    const flightPath = document.getElementById('rocketFlightPath');
    const areaPath = document.getElementById('rocketAreaPath');
    const ship = document.getElementById('rocketShip');
    const zoomDisplay = document.getElementById('rocketZoom');
    const starField = document.getElementById('rocketStars');
    const cameraLookaheadSeconds = 7;
    let state = 'idle';
    let wager = 0;
    let crashMultiplier = 0;
    let currentMultiplier = 1;
    let startedAt = 0;
    let frameId = 0;
    let roundNumber = 0;

    function randomCrashMultiplier() {
        const bucket = Math.random();
        let minimum;
        let maximum;
        if (bucket < 0.5) {
            [minimum, maximum] = [1.05, 1.6];
        } else if (bucket < 0.78) {
            [minimum, maximum] = [1.6, 2.5];
        } else if (bucket < 0.93) {
            [minimum, maximum] = [2.5, 5];
        } else if (bucket < 0.985) {
            [minimum, maximum] = [5, 12];
        } else {
            [minimum, maximum] = [12, MAX_MULTIPLIER];
        }
        return Math.min(
            MAX_MULTIPLIER,
            Math.round((minimum + Math.random() * (maximum - minimum)) * 100) / 100
        );
    }

    function drawStars() {
        for (let index = 0; index < 46; index += 1) {
            const star = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            star.setAttribute('cx', String(65 + Math.random() * 650));
            star.setAttribute('cy', String(30 + Math.random() * 255));
            star.setAttribute('r', String(0.7 + Math.random() * 1.4));
            star.setAttribute('class', 'rocket-star');
            star.style.setProperty('--star-delay', `${Math.random() * 3}s`);
            starField.append(star);
        }
    }

    function setStatus(text, mode) {
        statusDisplay.className = `rocket-status${mode ? ` ${mode}` : ''}`;
        const dot = document.createElement('span');
        statusDisplay.replaceChildren(dot, document.createTextNode(` ${text}`));
    }

    function renderFlight(multiplier, elapsedSeconds) {
        const visibleSeconds = elapsedSeconds + cameraLookaheadSeconds;
        const visibleMultiplier = Math.exp(GROWTH_RATE * visibleSeconds);
        const progress = elapsedSeconds / visibleSeconds;
        const pointCount = Math.max(1, Math.ceil(elapsedSeconds * 4));
        const points = Array.from({ length: pointCount + 1 }, (_, index) => {
            const pointTime = elapsedSeconds * index / pointCount;
            const pointMultiplier = Math.exp(GROWTH_RATE * pointTime);
            const x = 56 + (pointTime / visibleSeconds) * 674;
            const y = 310 - ((pointMultiplier - 1) / (visibleMultiplier - 1)) * 260;
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        });
        const x = 56 + (elapsedSeconds / visibleSeconds) * 674;
        const y = 310 - ((multiplier - 1) / (visibleMultiplier - 1)) * 260;
        const path = points.join(' ');
        flightPath.setAttribute('d', path);
        areaPath.setAttribute('d', `${path} L${x.toFixed(1)} 310 Z`);
        ship.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(-${22 + progress * 22})`);
        zoomDisplay.textContent = `ODDÁLENÍ ${(visibleSeconds / cameraLookaheadSeconds).toFixed(1)}×`;
    }

    function formatCredits(amount) {
        return amount.toLocaleString('cs-CZ');
    }

    function addHistory(resultMultiplier, result) {
        const empty = history.querySelector('.rocket-history-empty');
        if (empty) empty.remove();
        roundNumber += 1;
        const item = document.createElement('li');
        item.className = result === 'crash' ? 'rocket-history-crash' : 'rocket-history-cashout';
        const label = document.createElement('span');
        label.textContent = `Let ${roundNumber}`;
        const outcome = document.createElement('strong');
        outcome.textContent = result === 'crash'
            ? `Pád při ${resultMultiplier.toFixed(2)}×`
            : `Výběr při ${resultMultiplier.toFixed(2)}×`;
        item.append(label, outcome);
        history.prepend(item);
        while (history.children.length > 8) history.lastElementChild.remove();
    }

    function updateMultiplier(timestamp) {
        currentMultiplier = Math.min(
            Math.exp(Math.max(0, timestamp - startedAt) / 1000 * GROWTH_RATE),
            crashMultiplier
        );
        multiplierDisplay.textContent = `${currentMultiplier.toFixed(2)}×`;
        const elapsedSeconds = Math.max(0, timestamp - startedAt) / 1000;
        renderFlight(currentMultiplier, elapsedSeconds);
        const cashout = Math.floor(wager * currentMultiplier);
        cashoutButton.querySelector('strong').textContent = `${formatCredits(cashout)} kr · ${currentMultiplier.toFixed(2)}×`;
    }

    function finishCrash() {
        if (state !== 'running') return;
        state = 'crashed';
        window.cancelAnimationFrame(frameId);
        currentMultiplier = crashMultiplier;
        multiplierDisplay.textContent = `${crashMultiplier.toFixed(2)}×`;
        multiplierDisplay.classList.add('crashed');
        renderFlight(crashMultiplier, Math.max(0, performance.now() - startedAt) / 1000);
        setStatus('Raketa havarovala', 'danger');
        messageDisplay.textContent = `Pád při ${crashMultiplier.toFixed(2)}×. Sázka ${formatCredits(wager)} kreditů propadla.`;
        addHistory(crashMultiplier, 'crash');
        cashoutButton.disabled = true;
        startButton.disabled = false;
        betInput.disabled = false;
    }

    function tick(timestamp) {
        if (state !== 'running') return;
        updateMultiplier(timestamp);
        if (currentMultiplier >= crashMultiplier) {
            finishCrash();
            return;
        }
        frameId = window.requestAnimationFrame(tick);
    }

    async function startRound() {
        if (state === 'starting' || state === 'running' || state === 'cashing') return;
        const requestedBet = Number(betInput.value);
        const maximumBet = Math.floor(Number.MAX_SAFE_INTEGER / 36);
        if (!Number.isSafeInteger(requestedBet) || requestedBet < 1 || requestedBet > maximumBet) {
            window.CasinoApp.notify(`Zadej sázku od 1 do ${formatCredits(maximumBet)} kreditů.`);
            return;
        }

        state = 'starting';
        startButton.disabled = true;
        betInput.disabled = true;
        try {
            const acceptedBet = await window.CasinoApp.getWager('rocketBet');
            if (acceptedBet === null) {
                state = 'idle';
                startButton.disabled = false;
                betInput.disabled = false;
                return;
            }
            wager = acceptedBet;
            crashMultiplier = randomCrashMultiplier();
            currentMultiplier = 1;
            startedAt = performance.now();
            state = 'running';
            multiplierDisplay.classList.remove('crashed');
            multiplierDisplay.textContent = '1.00×';
            cashoutButton.disabled = false;
            cashoutButton.querySelector('strong').textContent = `${formatCredits(wager)} kr · 1.00×`;
            messageDisplay.textContent = 'Raketa letí! Vyber výhru kdykoliv před pádem.';
            setStatus('Let probíhá', 'flying');
            renderFlight(1, 0);
            frameId = window.requestAnimationFrame(tick);
        } catch (error) {
            console.error('Nepodařilo se odstartovat raketu.', error);
            window.CasinoApp.notify(error.message || 'Raketě se nepodařilo odstartovat. Zkus to znovu.');
            state = 'idle';
            startButton.disabled = false;
            betInput.disabled = false;
        }
    }

    async function cashOut() {
        if (state !== 'running') return;
        updateMultiplier(performance.now());
        if (currentMultiplier >= crashMultiplier) {
            finishCrash();
            return;
        }
        state = 'cashing';
        window.cancelAnimationFrame(frameId);
        cashoutButton.disabled = true;
        const payout = Math.floor(wager * currentMultiplier);
        try {
            const credited = await window.CasinoApp.payout(payout);
            setStatus(credited ? 'Výhra vybrána' : 'Výplata se nezdařila', credited ? 'success' : 'danger');
            messageDisplay.textContent = credited
                ? `Vybráno při ${currentMultiplier.toFixed(2)}× — ${formatCredits(payout)} kreditů připsáno.`
                : `Výhru ${formatCredits(payout)} kreditů se nepodařilo připsat.`;
            addHistory(currentMultiplier, 'cashout');
            state = 'cashed';
        } catch (error) {
            console.error('Nepodařilo se vybrat výhru z rakety.', error);
            window.CasinoApp.notify(error.message || 'Výhru se nepodařilo vybrat.');
            messageDisplay.textContent = 'Výplatu se nepodařilo dokončit. Zkontroluj připojení a zůstatek.';
            state = 'cashed';
        } finally {
            startButton.disabled = false;
            betInput.disabled = false;
        }
    }

    document.querySelectorAll('[data-rocket-bet]').forEach((button) => {
        button.addEventListener('click', () => {
            if (state === 'idle' || state === 'crashed' || state === 'cashed') {
                betInput.value = button.dataset.rocketBet;
            }
        });
    });
    startButton.addEventListener('click', startRound);
    cashoutButton.addEventListener('click', cashOut);
    drawStars();
})();
