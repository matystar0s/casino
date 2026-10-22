const suits = [
    { symbol: '♠', color: 'black-suit' },
    { symbol: '♥', color: 'red-suit' },
    { symbol: '♦', color: 'red-suit' },
    { symbol: '♣', color: 'black-suit' }
];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
let deck = [];
let playerHand = [];
let dealerHand = [];
let wager = 0;
let active = false;
let busy = false;

const playerCardsElement = document.getElementById('playerCards');
const dealerCardsElement = document.getElementById('dealerCards');
const playerScoreElement = document.getElementById('playerScore');
const dealerScoreElement = document.getElementById('dealerScore');
const resultElement = document.getElementById('result');
const dealButton = document.getElementById('dealButton');
const hitButton = document.getElementById('drawCardBtn');
const standButton = document.getElementById('endGameBtn');

function createDeck() {
    deck = suits.flatMap((suit) => ranks.map((rank) => ({
        rank,
        suit: suit.symbol,
        color: suit.color,
        value: rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(rank) ? 10 : Number(rank)
    })));
    for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function handValue(hand) {
    let total = hand.reduce((sum, card) => sum + card.value, 0);
    let aces = hand.filter((card) => card.rank === 'A').length;
    while (total > 21 && aces > 0) {
        total -= 10;
        aces -= 1;
    }
    return total;
}

function makeCard(card, hidden = false) {
    const element = document.createElement('div');
    element.className = hidden ? 'card card-back card-enter' : `card card-enter ${card.color}`;
    if (hidden) {
        element.setAttribute('aria-label', 'Skrytá karta dealera');
        element.textContent = '♠';
        return element;
    }

    element.setAttribute('aria-label', `${card.rank} ${card.suit}`);
    const top = document.createElement('span');
    top.className = 'card-corner card-corner-top';
    top.textContent = `${card.rank}${card.suit}`;
    const center = document.createElement('span');
    center.className = 'card-suit';
    center.textContent = card.suit;
    const bottom = document.createElement('span');
    bottom.className = 'card-corner card-corner-bottom';
    bottom.textContent = `${card.rank}${card.suit}`;
    element.append(top, center, bottom);
    return element;
}

function renderHand(hand, element, hideSecondCard = false) {
    element.replaceChildren();
    hand.forEach((card, index) => {
        element.append(makeCard(card, hideSecondCard && index === 1));
    });
}

function updateScores(revealDealer = false) {
    playerScoreElement.textContent = `Součet: ${handValue(playerHand)}`;
    dealerScoreElement.textContent = revealDealer
        ? `Součet: ${handValue(dealerHand)}`
        : `Viditelná karta: ${dealerHand[0] ? dealerHand[0].value : '—'}`;
}

function setRoundControls(inProgress) {
    dealButton.hidden = inProgress;
    hitButton.disabled = !inProgress;
    standButton.disabled = !inProgress;
    document.getElementById('betAmount').disabled = inProgress;
}

function drawFromDeck(hand) {
    const card = deck.pop();
    if (card) hand.push(card);
    return card;
}

function startNewGame() {
    if (active || busy) return;
    const nextWager = window.CasinoApp.getWager('betAmount');
    if (nextWager === null) return;

    wager = nextWager;
    playerHand = [];
    dealerHand = [];
    createDeck();
    active = true;
    busy = true;
    resultElement.textContent = 'Dealer rozdává karty…';
    playerCardsElement.replaceChildren();
    dealerCardsElement.replaceChildren();
    setRoundControls(true);

    const dealOrder = [
        [playerHand, playerCardsElement, false],
        [dealerHand, dealerCardsElement, false],
        [playerHand, playerCardsElement, false],
        [dealerHand, dealerCardsElement, true]
    ];

    dealOrder.forEach(([hand, element, hideSecondCard], index) => {
        window.setTimeout(() => {
            drawFromDeck(hand);
            renderHand(hand, element, hideSecondCard);
            updateScores();
            if (index === dealOrder.length - 1) {
                busy = false;
                const playerNatural = handValue(playerHand) === 21;
                const dealerNatural = handValue(dealerHand) === 21;
                if (dealerNatural) {
                    resolveRound();
                } else if (playerNatural) {
                    stand();
                } else {
                    resultElement.textContent = 'Jste na tahu. Lízněte kartu, nebo se zastavte.';
                }
            }
        }, index * 260);
    });
}

function drawCard() {
    if (!active || busy) return;
    const card = drawFromDeck(playerHand);
    if (!card) {
        window.CasinoApp.notify('V balíčku už nejsou karty.');
        return;
    }
    renderHand(playerHand, playerCardsElement);
    updateScores();
    const total = handValue(playerHand);
    if (total > 21) {
        finishRound('Prohra', 0, `Překročili jste 21 (${total}). Dealer vyhrává.`);
    } else if (total === 21) {
        stand();
    } else {
        resultElement.textContent = `Váš součet je ${total}. Chcete další kartu, nebo se zastavíte?`;
    }
}

function endGame() {
    stand();
}

function stand() {
    if (!active || busy) return;
    busy = true;
    renderHand(dealerHand, dealerCardsElement);
    updateScores(true);
    resultElement.textContent = 'Dealer odkrývá kartu…';

    function dealerTurn() {
        if (handValue(dealerHand) < 17 && deck.length > 0) {
            window.setTimeout(() => {
                drawFromDeck(dealerHand);
                renderHand(dealerHand, dealerCardsElement);
                updateScores(true);
                dealerTurn();
            }, 500);
            return;
        }
        busy = false;
        resolveRound();
    }

    dealerTurn();
}

function resolveRound() {
    if (!active) return;
    const playerTotal = handValue(playerHand);
    const dealerTotal = handValue(dealerHand);
    const playerNatural = playerHand.length === 2 && playerTotal === 21;
    const dealerNatural = dealerHand.length === 2 && dealerTotal === 21;
    let payout = 0;
    let message;

    if (playerTotal > 21 || (dealerTotal <= 21 && dealerTotal > playerTotal)) {
        message = `Prohra. Vy ${playerTotal}, dealer ${dealerTotal}.`;
    } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
        payout = playerNatural && !dealerNatural ? Math.round(wager * 2.5) : wager * 2;
        message = `Výhra! Vy ${playerTotal}, dealer ${dealerTotal}. Získáváte ${payout} kreditů.`;
    } else {
        payout = wager;
        message = `Remíza: vy ${playerTotal}, dealer ${dealerTotal}. Sázka se vrací.`;
    }

    finishRound(payout > wager ? 'Výhra' : payout === wager && payout > 0 ? 'Remíza' : 'Prohra', payout, message);
}

function finishRound(outcome, payout, message) {
    if (!active) return;
    active = false;
    busy = false;
    renderHand(dealerHand, dealerCardsElement);
    updateScores(true);
    const credited = payout === 0 || window.CasinoApp.payout(payout);
    resultElement.textContent = payout > 0 && !credited
        ? `${message} Výhru ${payout} kreditů se nepodařilo připsat.`
        : message;
    resultElement.dataset.outcome = outcome.toLocaleLowerCase('cs-CZ');
    setRoundControls(false);
    dealButton.textContent = 'Rozdat znovu';
    dealButton.hidden = false;
}
