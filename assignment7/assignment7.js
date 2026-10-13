const dealButtonElement = document.getElementById("dealButton");
const cardHandElement = document.getElementById("cardHand");
const discardPileElement = document.getElementById("discardPile");
const statusMessageElement = document.getElementById("statusMessage");
const returnDiscardButtonElement = document.getElementById("returnDiscardButton");
const computerHandElement = document.getElementById("computerHand");
const discardAllButtonElement = document.getElementById("discardAllButton");
const revealHandsButtonElement = document.getElementById("revealHandsButton");

const discardAreaElement = document.querySelector(".discard-area");

let computerHandRevealed = false;

const deck = [
    { name: "2 of Clubs", src: "cards/2 of clubs.png" },
    { name: "3 of Clubs", src: "cards/3 of clubs.png" },
    { name: "4 of Clubs", src: "cards/4 of clubs.png" },
    { name: "5 of Clubs", src: "cards/5 of clubs.png" },
    { name: "6 of Clubs", src: "cards/6 of clubs.png" },
    { name: "7 of Clubs", src: "cards/7 of clubs.png" },
    { name: "8 of Clubs", src: "cards/8 of clubs.png" },
    { name: "9 of Clubs", src: "cards/9 of clubs.png" },
    { name: "10 of Clubs", src: "cards/10 of clubs.png" },
    { name: "Jack of Clubs", src: "cards/jack of clubs.png" },
    { name: "Queen of Clubs", src: "cards/queen of clubs.png" },
    { name: "King of Clubs", src: "cards/king of clubs.png" },
    { name: "Ace of Clubs", src: "cards/ace of clubs.png" },

    { name: "2 of Diamonds", src: "cards/2 of diamonds.png" },
    { name: "3 of Diamonds", src: "cards/3 of diamonds.png" },
    { name: "4 of Diamonds", src: "cards/4 of diamonds.png" },
    { name: "5 of Diamonds", src: "cards/5 of diamonds.png" },
    { name: "6 of Diamonds", src: "cards/6 of diamonds.png" },
    { name: "7 of Diamonds", src: "cards/7 of diamonds.png" },
    { name: "8 of Diamonds", src: "cards/8 of diamonds.png" },
    { name: "9 of Diamonds", src: "cards/9 of diamonds.png" },
    { name: "10 of Diamonds", src: "cards/10 of diamonds.png" },
    { name: "Jack of Diamonds", src: "cards/jack of diamonds.png" },
    { name: "Queen of Diamonds", src: "cards/queen of diamonds.png" },
    { name: "King of Diamonds", src: "cards/king of diamonds.png" },
    { name: "Ace of Diamonds", src: "cards/ace of diamonds.png" },

    { name: "2 of Hearts", src: "cards/2 of hearts.png" },
    { name: "3 of Hearts", src: "cards/3 of hearts.png" },
    { name: "4 of Hearts", src: "cards/4 of hearts.png" },
    { name: "5 of Hearts", src: "cards/5 of hearts.png" },
    { name: "6 of Hearts", src: "cards/6 of hearts.png" },
    { name: "7 of Hearts", src: "cards/7 of hearts.png" },
    { name: "8 of Hearts", src: "cards/8 of hearts.png" },
    { name: "9 of Hearts", src: "cards/9 of hearts.png" },
    { name: "10 of Hearts", src: "cards/10 of hearts.png" },
    { name: "Jack of Hearts", src: "cards/jack of hearts.png" },
    { name: "Queen of Hearts", src: "cards/queen of hearts.png" },
    { name: "King of Hearts", src: "cards/king of hearts.png" },
    { name: "Ace of Hearts", src: "cards/ace of hearts.png" },

    { name: "2 of Spades", src: "cards/2 of spades.png" },
    { name: "3 of Spades", src: "cards/3 of spades.png" },
    { name: "4 of Spades", src: "cards/4 of spades.png" },
    { name: "5 of Spades", src: "cards/5 of spades.png" },
    { name: "6 of Spades", src: "cards/6 of spades.png" },
    { name: "7 of Spades", src: "cards/7 of spades.png" },
    { name: "8 of Spades", src: "cards/8 of spades.png" },
    { name: "9 of Spades", src: "cards/9 of spades.png" },
    { name: "10 of Spades", src: "cards/10 of spades.png" },
    { name: "Jack of Spades", src: "cards/jack of spades.png" },
    { name: "Queen of Spades", src: "cards/queen of spades.png" },
    { name: "King of Spades", src: "cards/king of spades.png" },
    { name: "Ace of Spades", src: "cards/ace of spades.png" }
];

const hand = [];
const computerHand = [];
const discarded = [];

function getStackName(stack) {
    switch (stack) {
        case deck:
            return "deck";
        case hand:
            return "hand";
        case discarded:
            return "discard pile";
        case computerHand:
            return "computer's hand";
        default:
            return "unknown stack";
    }
}

function moveCard(origin, destination, index) {
    if (!Number.isInteger(index) || index < 0 || index >= origin.length) return "Card not found.";

    const card = origin.splice(index, 1)[0];
    destination.push(card);

    const originName = getStackName(origin);
    const destinationName = getStackName(destination);

    return `Card ${card.name} has moved from ${originName} to ${destinationName}.`;
}

function createCardImage(card, draggable = false, animate = false) {
    const image = document.createElement("img");

    image.src = card.src;
    image.alt = card.name;
    image.title = card.name;
    image.className = "playing-card";
    image.draggable = false;

    if (draggable) {
        image.addEventListener("pointerdown", function (event) {
            startCardDrag(event, image, card);
        });
    }

    if (animate) {
        image.classList.add("card-landing");
    }

    return image;
}

function discardFromHand(card) {
    const index = hand.indexOf(card);

    if (index === -1) {
        statusMessageElement.textContent =
            "That card could not be found in your hand.";
        return;
    }

    const message = moveCard(hand, discarded, index);

    revealHandsButtonElement.disabled = true;

    renderHand();
    renderDiscardPile(card.name);

    statusMessageElement.textContent = message;
}

function isOverDiscardArea(x, y) {
    const rect = discardAreaElement.getBoundingClientRect();

    return x >= rect.left && x <= rect.right &&
           y >= rect.top && y <= rect.bottom;
}

function startCardDrag(event, image, card) {
    if (event.button !== 0) return;
    event.preventDefault();

    const rect = image.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    // Floating copy that follows the pointer
    const floater = image.cloneNode();
    floater.classList.add("drag-floater");
    floater.style.width = rect.width + "px";
    floater.style.left = rect.left + "px";
    floater.style.top = rect.top + "px";
    document.body.appendChild(floater);

    image.classList.add("dragging");
    document.body.classList.add("is-dragging");

    let overDiscard = false;

    function onMove(moveEvent) {
        floater.style.left = (moveEvent.clientX - offsetX) + "px";
        floater.style.top = (moveEvent.clientY - offsetY) + "px";

        overDiscard = isOverDiscardArea(moveEvent.clientX, moveEvent.clientY);
        discardPileElement.classList.toggle("drag-over", overDiscard);
    }

    function onEnd() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onEnd);
        document.removeEventListener("pointercancel", onEnd);

        floater.remove();
        image.classList.remove("dragging");
        document.body.classList.remove("is-dragging");
        discardPileElement.classList.remove("drag-over");

        if (overDiscard) {
            discardFromHand(card);
        }
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onEnd);
}

function renderHand() {
    cardHandElement.innerHTML = "";

    hand.forEach(function (card) {
        const image = createCardImage(card, true);
        cardHandElement.appendChild(image);
    });
}

function renderDiscardPile(newCardName = null) {
    discardPileElement.innerHTML = "";

    discarded.forEach(function (card) {
        const shouldAnimate = card.name === newCardName;
        const image = createCardImage(card, false, shouldAnimate);

        discardPileElement.appendChild(image);
    });
}

function renderComputerHand() {
    computerHandElement.innerHTML = "";

    computerHand.forEach(function (card) {
        const image = document.createElement("img");

        if (computerHandRevealed) {
            image.src = card.src;
            image.alt = card.name;
            image.title = card.name;
        } else {
            image.src = "cards/card back red.png";
            image.alt = "Face-down card";
            image.title = "Computer's hidden card";
        }

        image.className = "playing-card";
        computerHandElement.appendChild(image);
    });
}

dealButtonElement.addEventListener("click", function () {

    if (computerHandRevealed) {
        while (hand.length > 0) {
            moveCard(hand, deck, hand.length - 1);
        }

        while (computerHand.length > 0) {
            moveCard(computerHand, deck, computerHand.length - 1);
        }

        while (discarded.length > 0) {
            moveCard(discarded, deck, discarded.length - 1);
        }

        shuffleDeck();

        computerHandRevealed = false;
        revealHandsButtonElement.disabled = true;

        renderDiscardPile();
    }

    if (computerHand.length === 0) {
        computerHandRevealed = false;
        revealHandsButtonElement.disabled = true;

        const cardsPerHand = Math.min(5, Math.floor(deck.length / 2));

        for (let i = 0; i < cardsPerHand; i++) {
            let index = Math.floor(Math.random() * deck.length);
            moveCard(deck, hand, index);

            index = Math.floor(Math.random() * deck.length);
            moveCard(deck, computerHand, index);
        }

        renderHand();
        renderComputerHand();

        dealButtonElement.textContent = "Deal Cards";

        revealHandsButtonElement.disabled =
            computerHand.length === 0 || hand.length < 5;

        statusMessageElement.textContent =
            "Hands dealt. Choose cards to discard, then draw replacements.";

        return;
    }

    const missingCards = 5 - hand.length;

    if (missingCards === 0) {
        statusMessageElement.textContent =
            "Your hand is full. Discard cards before drawing replacements.";
        return;
    }

    const cardsToDraw = Math.min(missingCards, deck.length);

    for (let i = 0; i < cardsToDraw; i++) {
        const index = Math.floor(Math.random() * deck.length);
        moveCard(deck, hand, index);
    }

    renderHand();

    revealHandsButtonElement.disabled =
        computerHand.length === 0 || hand.length < 5;

    if (hand.length === 5) {
        statusMessageElement.textContent =
            `Drew ${cardsToDraw} replacement card(s). Ready for the showdown!`;
    } else {
        statusMessageElement.textContent =
            `Drew ${cardsToDraw} card(s), but the deck ran low. Your hand has ${hand.length} cards.`;
    }
});

discardAllButtonElement.addEventListener("click", function () {
    if (hand.length === 0) {
        statusMessageElement.textContent = "Your hand is already empty.";
        return;
    }

    const discardedCount = hand.length;

    while (hand.length > 0) {
        moveCard(hand, discarded, hand.length - 1);
    }

    revealHandsButtonElement.disabled = true;

    renderHand();
    renderDiscardPile();

    statusMessageElement.textContent =
        `Discarded all ${discardedCount} cards from your hand.`;
});

revealHandsButtonElement.addEventListener("click", function () {
    if (computerHand.length === 0) {
        statusMessageElement.textContent = "No cards to reveal.";
        return;
    }

    computerHandRevealed = true;

    dealButtonElement.textContent = "New Round";

    renderComputerHand();

    revealHandsButtonElement.disabled = true;

    statusMessageElement.textContent =
        "The computer reveals its hand!";
});

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

returnDiscardButtonElement.addEventListener("click", function () {
    if (discarded.length === 0) {
        statusMessageElement.textContent = "The discard pile is empty.";
        return;
    }

    const returnedCount = discarded.length;

    while (discarded.length > 0) {
        moveCard(discarded, deck, discarded.length - 1);
    }

    shuffleDeck();
    renderDiscardPile();

    statusMessageElement.textContent =
        `Returned ${returnedCount} cards to the deck and shuffled.`;
});