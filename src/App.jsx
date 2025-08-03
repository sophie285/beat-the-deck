import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [deckId, setDeckId] = useState(null);
  const [gridCards, setGridCards] = useState([]);
  const [remainingCards, setRemainingCards] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [flippedStacks, setFlippedStacks] = useState(new Array(9).fill(false));
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState('');

  useEffect(() => {
    setupDeck();
  }, []);

  async function setupDeck() {
    const res = await fetch('https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1');
    const data = await res.json();
    setDeckId(data.deck_id);

    const drawGrid = await fetch(`https://deckofcardsapi.com/api/deck/${data.deck_id}/draw/?count=9`);
    const gridData = await drawGrid.json();
    setGridCards(gridData.cards);

    const drawRest = await fetch(`https://deckofcardsapi.com/api/deck/${data.deck_id}/draw/?count=43`);
    const restData = await drawRest.json();
    setRemainingCards(restData.cards);

    setFlippedStacks(new Array(9).fill(false));
    setSelectedIndex(null);
    setGameOver(false);
    setGameResult('');
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
  }, [selectedIndex, flippedStacks, gameOver, remainingCards]);

  return (
    <div className="app-container">
      <h1 className="title">Beat the Deck</h1>

      <div className="grid">
        {gridCards.map((card, index) => (
          <img
            key={index}
            src={card.image}
            alt={`${card.value} of ${card.suit}`}
            className={`card ${selectedIndex === index ? 'selected' : ''} ${flippedStacks[index] ? 'flipped' : ''}`}
            onClick={() => {
              if (!flippedStacks[index] && !gameOver) {
                setSelectedIndex(index);
              }
            }}
          />
        ))}
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
    </div>
  );
}

export default App;
