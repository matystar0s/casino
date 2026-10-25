(() => {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const tabs = [...document.querySelectorAll('[data-game-tab]')];
    const panels = [...document.querySelectorAll('[data-game-panel]')];

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((item) => {
                const active = item === tab;
                item.classList.toggle('active', active);
                item.setAttribute('aria-selected', String(active));
            });
            panels.forEach((panel) => {
                const active = panel.dataset.gamePanel === tab.dataset.gameTab;
                panel.classList.toggle('active', active);
                panel.hidden = !active;
            });
        });
    });

    function shuffledDeck() {
        const deck = suits.flatMap((suit) => ranks.map((rank) => ({ suit, rank })));
        for (let index = deck.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
        }
        return deck;
    }

    function cardValue(rank) {
        if (rank === 'A') return 1;
        if (['10', 'J', 'Q', 'K'].includes(rank)) return 0;
        return Number(rank);
    }

    function baccaratValue(hand) {
        return hand.reduce((total, card) => total + cardValue(card.rank), 0) % 10;
    }

    function baccaratCardMarkup(card) {
        const element = document.createElement('span');
        element.className = `playing-card${['♥', '♦'].includes(card.suit) ? ' red-suit' : ''}`;
        element.textContent = `${card.rank}${card.suit}`;
        element.setAttribute('aria-label', `${card.rank} ${card.suit}`);
        return element;
    }

    function shouldBankerDraw(total, playerThird) {
        if (playerThird === null) return total <= 5;
        if (total <= 2) return true;
        if (total === 3) return playerThird !== 8;
        if (total === 4) return playerThird >= 2 && playerThird <= 7;
        if (total === 5) return playerThird >= 4 && playerThird <= 7;
        if (total === 6) return playerThird === 6 || playerThird === 7;
        return false;
    }

    const baccaratButton = document.getElementById('playBaccarat');
    baccaratButton.addEventListener('click', async () => {
        if (baccaratButton.disabled) return;
        baccaratButton.disabled = true;
        const wager = await window.CasinoApp.getWager('baccaratBet');
        if (wager === null) {
            baccaratButton.disabled = false;
            return;
        }
        const deck = shuffledDeck();
        const player = [deck.pop(), deck.pop()];
        const banker = [deck.pop(), deck.pop()];
        if (baccaratValue(player) < 8 && baccaratValue(banker) < 8) {
            let playerThird = null;
            if (baccaratValue(player) <= 5) {
                const thirdCard = deck.pop();
                playerThird = cardValue(thirdCard.rank);
                player.push(thirdCard);
            }
            if (shouldBankerDraw(baccaratValue(banker), playerThird)) {
                banker.push(deck.pop());
            }
        }
        const playerTotal = baccaratValue(player);
        const bankerTotal = baccaratValue(banker);
        const winner = playerTotal === bankerTotal
            ? 'tie'
            : playerTotal > bankerTotal ? 'player' : 'banker';
        const pick = document.getElementById('baccaratPick').value;
        const multiplier = winner === 'tie' ? 8 : winner === 'banker' ? 1.95 : 2;
        const push = winner === 'tie' && pick !== 'tie';
        const payout = push ? wager : pick === winner ? Math.floor(wager * multiplier) : 0;
        document.getElementById('bankerCards').replaceChildren(...banker.map(baccaratCardMarkup));
        document.getElementById('baccaratPlayerCards').replaceChildren(...player.map(baccaratCardMarkup));
        document.getElementById('bankerTotal').textContent = bankerTotal;
        document.getElementById('baccaratPlayerTotal').textContent = playerTotal;
        const winnerLabel = winner === 'tie' ? 'remíza' : winner === 'player' ? 'hráč' : 'bankéř';
        const credited = payout === 0 || await window.CasinoApp.payout(payout);
        document.getElementById('baccaratResult').textContent = payout > 0 && credited
            ? push
                ? `Remíza (${playerTotal} : ${bankerTotal}). Sázka se vrací: ${payout} kreditů.`
                : `Vyhrává ${winnerLabel} (${playerTotal} : ${bankerTotal}). Výplata ${payout} kreditů.`
            : payout > 0
                ? `Výsledek ${winnerLabel} (${playerTotal} : ${bankerTotal}), ale výplatu se nepodařilo připsat.`
                : `Vyhrává ${winnerLabel} (${playerTotal} : ${bankerTotal}). Tato sázka nevyhrála.`;
        baccaratButton.disabled = false;
    });

    const selectedKeno = new Set([1, 2, 3, 4, 5]);
    const kenoNumbers = document.getElementById('kenoNumbers');
    const kenoResult = document.getElementById('kenoResult');
    for (let number = 1; number <= 40; number += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'keno-number';
        button.textContent = number;
        button.setAttribute('aria-pressed', String(selectedKeno.has(number)));
        button.addEventListener('click', () => {
            if (selectedKeno.has(number)) {
                selectedKeno.delete(number);
            } else if (selectedKeno.size < 5) {
                selectedKeno.add(number);
            }
            button.classList.toggle('selected', selectedKeno.has(number));
            button.setAttribute('aria-pressed', String(selectedKeno.has(number)));
            kenoResult.textContent = `Označeno ${selectedKeno.size} z 5 čísel.`;
        });
        button.classList.toggle('selected', selectedKeno.has(number));
        kenoNumbers.append(button);
    }

    const kenoButton = document.getElementById('playKeno');
    kenoButton.addEventListener('click', async () => {
        if (kenoButton.disabled) return;
        if (selectedKeno.size !== 5) {
            window.CasinoApp.notify('Pro Keno označ přesně 5 čísel.');
            return;
        }
        kenoButton.disabled = true;
        kenoNumbers.querySelectorAll('button').forEach((button) => { button.disabled = true; });
        const wager = await window.CasinoApp.getWager('kenoBet');
        if (wager === null) {
            kenoButton.disabled = false;
            kenoNumbers.querySelectorAll('button').forEach((button) => { button.disabled = false; });
            return;
        }
        const drawn = new Set();
        while (drawn.size < 10) drawn.add(Math.floor(Math.random() * 40) + 1);
        const hits = [...selectedKeno].filter((number) => drawn.has(number)).length;
        const multiplier = hits === 5 ? 20 : hits === 4 ? 4 : hits === 3 ? 1 : 0;
        const payout = wager * multiplier;
        const credited = payout === 0 || await window.CasinoApp.payout(payout);
        kenoNumbers.querySelectorAll('.keno-number').forEach((button) => {
            const number = Number(button.textContent);
            button.classList.toggle('drawn', drawn.has(number));
            button.classList.toggle('hit', drawn.has(number) && selectedKeno.has(number));
        });
        const drawnList = document.getElementById('kenoDrawn');
        drawnList.replaceChildren();
        [...drawn].sort((a, b) => a - b).forEach((number) => {
            const item = document.createElement('span');
            item.textContent = number;
            item.className = selectedKeno.has(number) ? 'keno-drawn-hit' : '';
            drawnList.append(item);
        });
        kenoResult.textContent = payout > 0 && credited
            ? `Trefil/a jsi ${hits} z 5 čísel. Výhra ${payout} kreditů (${multiplier}×).`
            : payout > 0
                ? `Trefil/a jsi ${hits} z 5 čísel, ale výhru se nepodařilo připsat.`
                : `Trefil/a jsi ${hits} z 5 čísel. Tentokrát bez výhry.`;
        kenoButton.disabled = false;
        kenoNumbers.querySelectorAll('button').forEach((button) => { button.disabled = false; });
    });

    let pokerDeck = [];
    let pokerCards = [];
    let pokerInDraw = false;
    const pokerHand = document.getElementById('pokerHand');
    const dealPoker = document.getElementById('dealPoker');
    const drawPoker = document.getElementById('drawPoker');

    function renderPoker() {
        pokerHand.replaceChildren();
        pokerCards.forEach((card, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `poker-card${['♥', '♦'].includes(card.suit) ? ' red-suit' : ''}`;
            button.classList.toggle('held', pokerInDraw && card.held);
            button.disabled = !pokerInDraw;
            button.setAttribute('aria-pressed', String(pokerInDraw && card.held));
            button.setAttribute('aria-label', `${card.rank} ${card.suit}${card.held ? ', podržena' : ''}`);
            const face = document.createElement('span');
            face.textContent = card.rank;
            const suit = document.createElement('span');
            suit.textContent = card.suit;
            button.append(face, suit);
            button.addEventListener('click', () => {
                if (!pokerInDraw) return;
                pokerCards[index].held = !pokerCards[index].held;
                renderPoker();
            });
            pokerHand.append(button);
        });
    }

    function pokerRank(card) {
        return ranks.indexOf(card.rank) + 2;
    }

    function evaluatePoker(hand) {
        const values = hand.map(pokerRank).sort((a, b) => a - b);
        const counts = new Map();
        values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
        const groups = [...counts.values()].sort((a, b) => b - a);
        const flush = hand.every((card) => card.suit === hand[0].suit);
        const regularStraight = values.every((value, index) => index === 0 || value === values[index - 1] + 1);
        const wheelStraight = values.join(',') === '2,3,4,5,14';
        const straight = regularStraight || wheelStraight;
        if (flush && straight) return { name: 'Postupka v barvě', multiplier: 50 };
        if (groups[0] === 4) return { name: 'Čtveřice', multiplier: 25 };
        if (groups[0] === 3 && groups[1] === 2) return { name: 'Full house', multiplier: 9 };
        if (flush) return { name: 'Barva', multiplier: 6 };
        if (straight) return { name: 'Postupka', multiplier: 4 };
        if (groups[0] === 3) return { name: 'Trojice', multiplier: 3 };
        if (groups[0] === 2 && groups[1] === 2) return { name: 'Dva páry', multiplier: 2 };
        const highPair = [...counts.entries()].some(([rank, count]) => count === 2 && rank >= 11);
        if (highPair) return { name: 'Pár kluků nebo vyšší', multiplier: 1 };
        return { name: 'Bez výherní kombinace', multiplier: 0 };
    }

    dealPoker.addEventListener('click', async () => {
        if (dealPoker.disabled || pokerInDraw) return;
        dealPoker.disabled = true;
        const wager = await window.CasinoApp.getWager('pokerBet');
        if (wager === null) {
            dealPoker.disabled = false;
            return;
        }
        pokerDeck = shuffledDeck();
        pokerCards = Array.from({ length: 5 }, () => ({ ...pokerDeck.pop(), held: false }));
        pokerInDraw = true;
        document.getElementById('pokerResult').textContent = 'Vyber karty, které chceš podržet.';
        document.getElementById('pokerBet').disabled = true;
        drawPoker.disabled = false;
        renderPoker();
    });

    drawPoker.addEventListener('click', async () => {
        if (!pokerInDraw || drawPoker.disabled) return;
        drawPoker.disabled = true;
        pokerCards = pokerCards.map((card) => card.held ? card : { ...pokerDeck.pop(), held: false });
        pokerInDraw = false;
        renderPoker();
        const combination = evaluatePoker(pokerCards);
        const wager = Number(document.getElementById('pokerBet').value);
        const payout = wager * combination.multiplier;
        const credited = payout === 0 || await window.CasinoApp.payout(payout);
        document.getElementById('pokerResult').textContent = payout > 0 && credited
            ? `${combination.name}! Výplata ${payout} kreditů (${combination.multiplier}×).`
            : payout > 0
                ? `${combination.name}, ale výhru se nepodařilo připsat.`
                : `${combination.name}. Zkus další rozdání.`;
        document.getElementById('pokerBet').disabled = false;
        dealPoker.disabled = false;
    });
})();
