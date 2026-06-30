import { SUBJECT_REGISTRY } from '../config/subjects.js';

export function generateMathQuestion(topicId, difficulty) {
  const limits = SUBJECT_REGISTRY.math.difficultyPresets[difficulty] || { min: 10, max: 99 };
  const min = limits.min;
  const max = limits.max;

  // Generate random operands
  const num1 = Math.floor(Math.random() * (max - min + 1)) + min;
  const num2 = Math.floor(Math.random() * (max - min + 1)) + min;

  let formula = '';
  let correctAnswer = 0;
  let category = '';

  switch (topicId) {
    case 'add':
      correctAnswer = num1 + num2;
      formula = `${num1} + ${num2} = ?`;
      category = 'Addition';
      break;
    case 'subtract':
      // Ensure positive result for easy/medium
      if (difficulty !== 'hard') {
        const big = Math.max(num1, num2);
        const small = Math.min(num1, num2);
        correctAnswer = big - small;
        formula = `${big} - ${small} = ?`;
      } else {
        correctAnswer = num1 - num2;
        formula = `${num1} - ${num2} = ?`;
      }
      category = 'Subtraction';
      break;
    case 'multiply':
      // Shrink hard operand limits for multiplication to keep it solvable in head
      const multMax = difficulty === 'hard' ? 25 : (difficulty === 'medium' ? 12 : 9);
      const multMin = difficulty === 'hard' ? 5 : 2;
      const m1 = Math.floor(Math.random() * (multMax - multMin + 1)) + multMin;
      const m2 = Math.floor(Math.random() * (multMax - multMin + 1)) + multMin;
      correctAnswer = m1 * m2;
      formula = `${m1} × ${m2} = ?`;
      category = 'Multiplication';
      break;
    case 'divide':
      // Ensure clean integer division by multiplying first
      const divMax = difficulty === 'hard' ? 15 : (difficulty === 'medium' ? 10 : 9);
      const divMin = 2;
      const operand2 = Math.floor(Math.random() * (divMax - divMin + 1)) + divMin;
      const product = operand2 * (Math.floor(Math.random() * (divMax - divMin + 1)) + divMin);
      correctAnswer = product / operand2;
      formula = `${product} ÷ ${operand2} = ?`;
      category = 'Division';
      break;
    default:
      correctAnswer = num1 + num2;
      formula = `${num1} + ${num2} = ?`;
      category = 'Addition';
  }

  // Distractors generation
  const choices = new Set();
  choices.add(correctAnswer);

  const offsets = [-1, 1, -2, 2, -10, 10, -5, 5];
  while (choices.size < 4) {
    const offset = offsets[Math.floor(Math.random() * offsets.length)];
    const distractor = correctAnswer + offset;
    // Don't add negative values unless hard difficulty
    if (distractor > 0 || difficulty === 'hard') {
      choices.add(distractor);
    }
  }

  return {
    formula,
    correct: correctAnswer,
    choices: Array.from(choices).sort(() => Math.random() - 0.5),
    category
  };
}
