import { useEffect, useRef, useState } from 'react';
import './App.css';

const CARD_BACK_IMAGE = 'https://deckofcardsapi.com/static/img/back.png';
const FLASH_DURATION_MS = 600;

function App() {
  const [deckId, setDeckId] = useState(null);
  const [gridCards, setGridCards] = useState([]);
  const [remainingCards, setRemainingCards] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [flippedStacks, setFlippedStacks] = useState(new Array(9).fill(false));
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState({ index: null, correct: null });

  const flashTimeoutRef = useRef(null);
  const rulesButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const prevShowRulesRef = useRef(false);

  useEffect(() => {
    setupDeck();
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (showRules) {
      closeButtonRef.current?.focus();
    } else if (prevShowRulesRef.current) {
      rulesButtonRef.current?.focus();
    }
    prevShowRulesRef.current = showRules;
  }, [showRules]);

  async function setupDeck() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1');
      if (!res.ok) throw new Error('Failed to create deck');
      const data = await res.json();
      if (!data.success) throw new Error('Failed to create deck');
      setDeckId(data.deck_id);

      const drawGrid = await fetch(`https://deckofcardsapi.com/api/deck/${data.deck_id}/draw/?count=9`);
      if (!drawGrid.ok) throw new Error('Failed to draw cards');
      const gridData = await drawGrid.json();
      setGridCards(gridData.cards);

      const drawRest = await fetch(`https://deckofcardsapi.com/api/deck/${data.deck_id}/draw/?count=43`);
      if (!drawRest.ok) throw new Error('Failed to draw cards');
      const restData = await drawRest.json();
      setRemainingCards(restData.cards);

      setFlippedStacks(new Array(9).fill(false));
      setSelectedIndex(null);
      setGameOver(false);
      setGameResult('');
      setFlash({ index: null, correct: null });
    } catch {
      setError('Could not load a new deck. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function getCardValue(card) {
    const faceValues = {
      JACK: 11,
      QUEEN: 12,
      KING: 13,
      ACE: 14,
    };
    return faceValues[card.value] || parseInt(card.value);
  }

  function handleGuess(direction) {
    if (remainingCards.length === 0 || selectedIndex === null) return;

    const nextCard = remainingCards[0];
    const rest = remainingCards.slice(1);
    setRemainingCards(rest);

    const topCard = gridCards[selectedIndex];
    const topValue = getCardValue(topCard);
    const newValue = getCardValue(nextCard);

    const isCorrect =
      (direction === 'higher' && newValue > topValue) ||
      (direction === 'lower' && newValue < topValue);

    const updatedGrid = [...gridCards];
    updatedGrid[selectedIndex] = nextCard;
    setGridCards(updatedGrid);

    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlash({ index: selectedIndex, correct: isCorrect });
    flashTimeoutRef.current = setTimeout(() => {
      setFlash({ index: null, correct: null });
    }, FLASH_DURATION_MS);

    if (isCorrect) {
      // keep stack selected
    } else {
      const updatedFlipped = [...flippedStacks];
      updatedFlipped[selectedIndex] = true;
      setFlippedStacks(updatedFlipped);
      setSelectedIndex(null); // only clear selection on wrong guess

      // Loss condition: all stacks flipped
      if (updatedFlipped.every((f) => f)) {
        setGameResult('lose');
        setGameOver(true);
        return;
      }
    }

    // Final card played
    if (rest.length === 0) {
      if (isCorrect) {
        setGameResult('win');
      } else {
        const updatedFlipped = [...flippedStacks];
        updatedFlipped[selectedIndex] = true;
        setFlippedStacks(updatedFlipped);
        setGameResult('lose');
      }
      setGameOver(true);
    }
  }

  function restartGame() {
    setupDeck();
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (showRules) {
        if (e.key === 'Escape') {
          setShowRules(false);
        }
        return;
      }

      if (gameOver) return;

      // Select stack 1–9
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (!flippedStacks[index]) {
          setSelectedIndex(index);
        }
        return;
      }

      // Move between stacks with arrow keys (horizontal only)
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !gameOver) {
        if (selectedIndex === null) return;

        let dir = e.key === 'ArrowRight' ? 1 : -1;
        let i = selectedIndex;

        for (let step = 0; step < 9; step++) {
          i = (i + dir + 9) % 9;
          if (!flippedStacks[i]) {
            setSelectedIndex(i);
            break;
          }
        }
        return;
      }

      // Guess (up/down or space)
      if (selectedIndex !== null && remainingCards.length > 0) {
        if (e.key === 'ArrowUp') {
          handleGuess('higher');
        }
        if (e.key === 'ArrowDown') {
          handleGuess('lower');
        }
        if (e.key === ' ') {
          const randomGuess = Math.random() < 0.5 ? 'higher' : 'lower';
          handleGuess(randomGuess);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, flippedStacks, gameOver, remainingCards, showRules]);

  if (loading) {
    return (
      <div className="app-container">
        <h1 className="title">Beat the Deck</h1>
        <p className="status-message">Shuffling deck…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <h1 className="title">Beat the Deck</h1>
        <p className="status-message status-error">{error}</p>
        <button onClick={setupDeck}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <h1 className="title">Beat the Deck</h1>
      <button
        ref={rulesButtonRef}
        className="rules-icon"
        onClick={() => setShowRules(true)}
        aria-label="Show rules"
        title="Show rules"
      >
        ?
      </button>

      <div className="grid">
        {gridCards.map((card, index) => {
          const isFlipped = flippedStacks[index];
          const isSelected = selectedIndex === index;
          const flashClass =
            flash.index === index ? (flash.correct ? 'flash-correct' : 'flash-incorrect') : '';

          return (
            <div
              key={index}
              className={`card-wrapper ${isSelected ? 'selected' : ''} ${isFlipped ? 'flipped' : ''} ${flashClass}`}
              onClick={() => {
                if (!isFlipped && !gameOver) {
                  setSelectedIndex(index);
                }
              }}
            >
              <div className="card-inner">
                <img
                  src={card.image}
                  alt={`${card.value} of ${card.suit}`}
                  className="card-face card-front"
                />
                <img src={CARD_BACK_IMAGE} alt="" className="card-face card-back" />
              </div>
            </div>
          );
        })}
      </div>

      {!gameOver && selectedIndex !== null && (
        <div style={{ marginTop: '20px' }}>
          <button onClick={() => handleGuess('higher')}>Higher</button>
          <button onClick={() => handleGuess('lower')} style={{ marginLeft: '10px' }}>
            Lower
          </button>
        </div>
      )}

      <p style={{ marginTop: '30px' }}>Cards remaining in deck: {remainingCards.length}</p>

      {gameOver && (
        <div style={{ marginTop: '20px' }}>
          <h2>{gameResult === 'win' ? '🎉 You won!' : '😢 You lost.'}</h2>
          <button onClick={restartGame} style={{ marginTop: '10px' }}>
            Play Again
          </button>
        </div>
      )}
      {showRules && (
        <div className="rules-popup" role="dialog" aria-modal="true" aria-labelledby="rules-title">
          <div className="rules-content">
            <button
              ref={closeButtonRef}
              className="close-icon"
              onClick={() => setShowRules(false)}
              aria-label="Close rules"
            >
              ×
            </button>
            <h3 id="rules-title">How to Play</h3>
            <ul>
              <li>A 3×3 grid of cards is dealt from a shuffled deck.</li>
              <li>You may select any visible stack and guess if the next card is <strong>higher</strong> or <strong>lower</strong>.</li>
              <li>If you’re wrong, the stack is flipped and becomes inactive.</li>
              <li>You win if you use all 43 cards from the deck.</li>
              <li>You must get the last card correct to win.</li>
              <li>You lose if all 9 stacks are flipped before the deck runs out.</li>
              <li>Use keyboard: 1–9 to select stacks, arrows to guess, space to guess randomly, Esc to close this popup.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
