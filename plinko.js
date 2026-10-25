(() => {
    const ROWS = 8;
    const WIDTH = 520;
    const HEIGHT = 370;
    const X_GAP = 42;
    const Y_START = 36;
    const Y_GAP = 34;
    const SLOT_Y = 322;
    const MULTIPLIERS = {
        low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
        medium: [12, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 12],
        high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29]
    };
    const canvas = document.getElementById('plinkoBoard');
    const context = canvas.getContext('2d');
    const betInput = document.getElementById('plinkoBet');
    const dropButton = document.getElementById('dropPlinko');
    const result = document.getElementById('plinkoResult');
    const slots = document.getElementById('plinkoSlots');
    const history = document.getElementById('plinkoHistory');
    const roundCounter = document.getElementById('plinkoRounds');
    const netCounter = document.getElementById('plinkoNet');
    const riskLabel = document.getElementById('plinkoRiskLabel');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let busy = false;
    let rounds = 0;
    let net = 0;
    let ball = null;
    let animationFrame = 0;

    function selectedRisk() {
        return document.querySelector('input[name="plinkoRisk"]:checked').value;
    }

    function pegPosition(row, index) {
        return {
            x: WIDTH / 2 + (index - row / 2) * X_GAP,
            y: Y_START + row * Y_GAP
        };
    }

    function slotPosition(index) {
        return {
            x: WIDTH / 2 + (index - ROWS / 2) * X_GAP,
            y: SLOT_Y
        };
    }

    function drawBoard(timestamp = 0) {
        if (!context) return;
        const pixelRatio = window.devicePixelRatio || 1;
        const cssWidth = canvas.clientWidth;
        if (!cssWidth) return;
        const scale = cssWidth / WIDTH;
        const height = HEIGHT * scale;
        if (canvas.width !== Math.round(cssWidth * pixelRatio) ||
            canvas.height !== Math.round(height * pixelRatio)) {
            canvas.width = Math.round(cssWidth * pixelRatio);
            canvas.height = Math.round(height * pixelRatio);
        }
        context.setTransform(pixelRatio * scale, 0, 0, pixelRatio * scale, 0, 0);
        context.clearRect(0, 0, WIDTH, HEIGHT);

        const glow = context.createRadialGradient(WIDTH / 2, 160, 20, WIDTH / 2, 160, 280);
        glow.addColorStop(0, 'rgba(52, 173, 132, 0.12)');
        glow.addColorStop(1, 'rgba(52, 173, 132, 0)');
        context.fillStyle = glow;
        context.fillRect(0, 0, WIDTH, HEIGHT);

        for (let row = 0; row < ROWS; row += 1) {
            for (let index = 0; index <= row; index += 1) {
                const peg = pegPosition(row, index);
                context.beginPath();
                context.arc(peg.x, peg.y, 5, 0, Math.PI * 2);
                context.fillStyle = 'rgba(9, 21, 16, 0.5)';
                context.fill();
                context.beginPath();
                context.arc(peg.x, peg.y - 1, 3.2, 0, Math.PI * 2);
                context.fillStyle = '#d9c27a';
                context.shadowColor = 'rgba(231, 200, 117, 0.52)';
                context.shadowBlur = 9;
                context.fill();
                context.shadowBlur = 0;
            }
        }

        context.strokeStyle = 'rgba(220, 190, 115, 0.18)';
        context.lineWidth = 1;
        for (let index = 0; index <= ROWS; index += 1) {
            const x = slotPosition(index).x;
            context.beginPath();
            context.moveTo(x - X_GAP / 2, SLOT_Y - 13);
            context.lineTo(x - X_GAP / 2, SLOT_Y + 15);
            context.stroke();
        }
        context.beginPath();
        context.moveTo(WIDTH / 2 - (ROWS + 1) * X_GAP / 2, SLOT_Y + 16);
        context.lineTo(WIDTH / 2 + (ROWS + 1) * X_GAP / 2, SLOT_Y + 16);
        context.stroke();

        if (ball) {
            const elapsed = Math.max(0, timestamp - ball.startedAt);
            const segment = Math.max(
                0,
                Math.min(Math.floor(elapsed / ball.segmentDuration), ball.path.length - 2)
            );
            const progress = Math.max(
                0,
                Math.min((elapsed - segment * ball.segmentDuration) / ball.segmentDuration, 1)
            );
            const eased = progress * progress * (3 - 2 * progress);
            const from = ball.path[segment];
            const to = ball.path[segment + 1];
            const x = from.x + (to.x - from.x) * eased;
            const y = from.y + (to.y - from.y) * eased;
            context.beginPath();
            context.arc(x, y, 8, 0, Math.PI * 2);
            context.fillStyle = '#f5d879';
            context.shadowColor = '#f5d879';
            context.shadowBlur = 18;
            context.fill();
            context.beginPath();
            context.arc(x - 2, y - 2, 2.4, 0, Math.PI * 2);
            context.fillStyle = '#fff9df';
            context.fill();
            context.shadowBlur = 0;
            if (elapsed < ball.duration) {
                animationFrame = window.requestAnimationFrame(drawBoard);
            }
        }
    }

    function renderMultipliers() {
        const risk = selectedRisk();
        const values = MULTIPLIERS[risk];
        slots.replaceChildren();
        riskLabel.textContent = risk === 'low'
            ? 'Nízké riziko'
            : risk === 'high' ? 'Vysoké riziko' : 'Střední riziko';
        values.forEach((multiplier, index) => {
            const item = document.createElement('span');
            item.className = 'plinko-slot';
            item.dataset.edge = String(Math.min(index, ROWS - index));
            item.textContent = `${multiplier}×`;
            item.setAttribute('aria-label', `Políčko ${index + 1}: násobek ${multiplier}`);
            slots.append(item);
        });
    }

    function makePath() {
        let position = 0;
        const path = [{ x: WIDTH / 2, y: 13 }];
        for (let step = 0; step < ROWS; step += 1) {
            position += Math.random() < 0.5 ? 0 : 1;
            const peg = pegPosition(step, position);
            const side = Math.random() < 0.5 ? -1 : 1;
            path.push({ x: peg.x + side * 15, y: peg.y - 12 });
            path.push({ x: peg.x + side * 15, y: peg.y + 10 });
        }
        path.push(slotPosition(position));
        return { path, position };
    }

    function addHistoryEntry(wager, payout, multiplier) {
        const empty = history.querySelector('.plinko-history-empty');
        if (empty) empty.remove();
        const item = document.createElement('li');
        item.className = payout > wager ? 'history-win' : payout > 0 ? 'history-return' : 'history-loss';
        const risk = selectedRisk();
        const label = document.createElement('span');
        label.textContent = `${rounds}. kolo · ${risk === 'low' ? 'nízké' : risk === 'high' ? 'vysoké' : 'střední'} riziko`;
        const value = document.createElement('strong');
        value.textContent = `${multiplier}× · ${payout > wager ? '+' : ''}${payout - wager} kreditů`;
        item.append(label, value);
        history.prepend(item);
        while (history.children.length > 8) history.lastElementChild.remove();
    }

    function setControlsDisabled(disabled) {
        betInput.disabled = disabled;
        document.querySelectorAll('input[name="plinkoRisk"], [data-bet]').forEach((control) => {
            control.disabled = disabled;
        });
        dropButton.disabled = disabled;
    }

    async function dropBall() {
        if (busy) return;
        busy = true;
        dropButton.disabled = true;
        const wager = await window.CasinoApp.getWager('plinkoBet');
        if (wager === null) {
            busy = false;
            dropButton.disabled = false;
            return;
        }

        setControlsDisabled(true);
        const risk = selectedRisk();
        const { path, position } = makePath();
        const multiplier = MULTIPLIERS[risk][position];
        const payout = Math.floor(wager * multiplier);
        const duration = reducedMotion.matches ? 80 : 150 * (path.length - 1);
        const segmentDuration = duration / (path.length - 1);
        ball = { path, startedAt: performance.now(), segmentDuration, duration };
        result.textContent = 'Kulička poskakuje mezi kolíky…';
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(drawBoard);
        await new Promise((resolve) => window.setTimeout(resolve, duration));
        window.cancelAnimationFrame(animationFrame);
        ball = null;
        drawBoard();

        const credited = payout === 0 || await window.CasinoApp.payout(payout);
        rounds += 1;
        net += credited ? payout - wager : -wager;
        roundCounter.textContent = rounds.toLocaleString('cs-CZ');
        netCounter.textContent = `${net > 0 ? '+' : ''}${net.toLocaleString('cs-CZ')}`;
        netCounter.classList.toggle('positive', net > 0);
        netCounter.classList.toggle('negative', net < 0);
        addHistoryEntry(wager, credited ? payout : 0, multiplier);
        result.textContent = payout > 0 && credited
            ? `Dopadla na ${multiplier}×. Sázka ${wager} → výplata ${payout} kreditů.`
            : payout > 0
                ? `Dopadla na ${multiplier}×, ale výplatu ${payout} kreditů se nepodařilo připsat.`
                : `Dopadla na ${multiplier}×. Tentokrát bez výhry.`;
        setControlsDisabled(false);
        busy = false;
        dropButton.focus();
    }

    document.querySelectorAll('[data-bet]').forEach((button) => {
        button.addEventListener('click', () => {
            betInput.value = button.dataset.bet;
            betInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
    document.querySelectorAll('input[name="plinkoRisk"]').forEach((input) => {
        input.addEventListener('change', renderMultipliers);
    });
    dropButton.addEventListener('click', dropBall);
    window.addEventListener('resize', drawBoard);
    renderMultipliers();
    drawBoard();
})();
