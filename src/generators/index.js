import { generateMathQuestion } from './math.js';
import { generateEnglishQuestion } from './english.js';

const GeneratorRegistry = {
  add: generateMathQuestion,
  subtract: generateMathQuestion,
  multiply: generateMathQuestion,
  divide: generateMathQuestion,
  spelling: generateEnglishQuestion,
  vocabulary: generateEnglishQuestion,
  grammar: generateEnglishQuestion
};

/**
 * Extensible dispatcher for generating quiz questions
 * @param {string} subject - e.g., 'math', 'english'
 * @param {string} difficulty - 'easy', 'medium', 'hard'
 * @param {Array<string>} topics - e.g., ['add', 'subtract']
 * @param {number} count - number of questions to generate
 */
export function generateQuestions(subject, difficulty, topics, count) {
  const selectedSubject = subject || 'math';
  const selectedDifficulty = difficulty || 'medium';
  
  const selectedTopics = (topics && topics.length > 0) 
    ? topics 
    : (selectedSubject === 'math' ? ['add'] : ['spelling']);

  const questions = [];
  
  for (let i = 0; i < count; i++) {
    const topic = selectedTopics[Math.floor(Math.random() * selectedTopics.length)];
    const generator = GeneratorRegistry[topic];
    
    if (generator) {
      questions.push(generator(topic, selectedDifficulty));
    } else {
      questions.push(generateMathQuestion('add', selectedDifficulty));
    }
  }

  return questions;
}
