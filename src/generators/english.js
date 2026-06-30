const ENGLISH_DATABASE = {
  spelling: {
    easy: [
      { formula: 'Choose the correct spelling of the fruit:', correct: 'apple', choices: ['aple', 'apple', 'appel', 'apell'], category: 'Spelling' },
      { formula: 'Choose the correct spelling of 🍌:', correct: 'banana', choices: ['banana', 'bannana', 'banan', 'bananna'], category: 'Spelling' },
      { formula: 'Choose the correct spelling of 🐱:', correct: 'cat', choices: ['kat', 'cat', 'catt', 'cet'], category: 'Spelling' },
      { formula: 'Choose the correct spelling of 🐶:', correct: 'dog', choices: ['dog', 'dogg', 'doge', 'dok'], category: 'Spelling' },
      { formula: 'Choose the correct spelling of 🏫:', correct: 'school', choices: ['shool', 'school', 'scool', 'schoole'], category: 'Spelling' }
    ],
    medium: [
      { formula: 'Choose the correct spelling:', correct: 'beautiful', choices: ['beautyful', 'beautiful', 'beautifull', 'beautifil'], category: 'Spelling' },
      { formula: 'Choose the correct spelling:', correct: 'receive', choices: ['recieve', 'receive', 'receve', 'recevei'], category: 'Spelling' },
      { formula: 'Choose the correct spelling:', correct: 'calendar', choices: ['calender', 'calendar', 'calandar', 'calendur'], category: 'Spelling' },
      { formula: 'Choose the correct spelling:', correct: 'because', choices: ['becouse', 'because', 'becoz', 'becuase'], category: 'Spelling' },
      { formula: 'Choose the correct spelling:', correct: 'friend', choices: ['freind', 'friend', 'frind', 'frend'], category: 'Spelling' }
    ],
    hard: [
      { formula: 'Choose the correct spelling:', correct: 'accommodation', choices: ['acomodation', 'accomodation', 'accommodation', 'accommodacion'], category: 'Spelling' },
      { formula: 'Choose the correct spelling:', correct: 'unnecessary', choices: ['unecessary', 'unnecesary', 'unnecessary', 'unneccessary'], category: 'Spelling' },
      { formula: 'Choose the correct spelling:', correct: 'occurred', choices: ['occured', 'ocurred', 'occurred', 'ocured'], category: 'Spelling' },
      { formula: 'Choose the correct spelling:', correct: 'separate', choices: ['seperate', 'separate', 'seperat', 'saparate'], category: 'Spelling' },
      { formula: 'Choose the correct spelling:', correct: 'definitely', choices: ['definately', 'definitely', 'definitly', 'definatly'], category: 'Spelling' }
    ]
  },
  vocabulary: {
    easy: [
      { formula: 'What is the opposite of "hot"?', correct: 'cold', choices: ['cold', 'warm', 'wet', 'dry'], category: 'Vocabulary' },
      { formula: 'A baby cat is called a...', correct: 'kitten', choices: ['puppy', 'kitten', 'cub', 'calf'], category: 'Vocabulary' },
      { formula: 'Which animal can fly?', correct: 'bird', choices: ['dog', 'bird', 'cat', 'fish'], category: 'Vocabulary' },
      { formula: 'What is the opposite of "happy"?', correct: 'sad', choices: ['sad', 'glad', 'mad', 'excited'], category: 'Vocabulary' },
      { formula: 'We hear with our...', correct: 'ears', choices: ['eyes', 'ears', 'nose', 'hands'], category: 'Vocabulary' }
    ],
    medium: [
      { formula: 'What does the word "enormous" mean?', correct: 'very big', choices: ['very small', 'very big', 'very fast', 'very slow'], category: 'Vocabulary' },
      { formula: 'What is a synonym of "happy"?', correct: 'joyful', choices: ['sad', 'joyful', 'angry', 'tired'], category: 'Vocabulary' },
      { formula: 'The place where books are kept is a...', correct: 'library', choices: ['bakery', 'library', 'kitchen', 'gym'], category: 'Vocabulary' },
      { formula: 'What is the opposite of "brave"?', correct: 'cowardly', choices: ['strong', 'fearless', 'cowardly', 'smart'], category: 'Vocabulary' },
      { formula: 'A person who cuts wood is a...', correct: 'lumberjack', choices: ['carpenter', 'lumberjack', 'butcher', 'chef'], category: 'Vocabulary' }
    ],
    hard: [
      { formula: 'What does "benevolent" mean?', correct: 'kind and helpful', choices: ['kind and helpful', 'mean and greedy', 'fast and agile', 'lazy and sleepy'], category: 'Vocabulary' },
      { formula: 'What is the antonym of "melancholy"?', correct: 'cheerful', choices: ['sadness', 'cheerful', 'angry', 'indifferent'], category: 'Vocabulary' },
      { formula: 'A person who studies stars is an...', correct: 'astronomer', choices: ['astrologist', 'astronomer', 'astronaut', 'architect'], category: 'Vocabulary' },
      { formula: 'What does the word "ubiquitous" mean?', correct: 'found everywhere', choices: ['rare', 'found everywhere', 'very clean', 'noisy'], category: 'Vocabulary' },
      { formula: 'What is a synonym for "meticulous"?', correct: 'extremely careful', choices: ['lazy', 'sloppy', 'extremely careful', 'very quick'], category: 'Vocabulary' }
    ]
  },
  grammar: {
    easy: [
      { formula: 'She ___ to school every day.', correct: 'goes', choices: ['go', 'goes', 'going', 'gone'], category: 'Grammar' },
      { formula: 'I have ___ apple in my bag.', correct: 'an', choices: ['a', 'an', 'the', 'some'], category: 'Grammar' },
      { formula: 'They ___ playing football now.', correct: 'are', choices: ['is', 'am', 'are', 'be'], category: 'Grammar' },
      { formula: 'He ___ a new bicycle yesterday.', correct: 'bought', choices: ['buy', 'buys', 'bought', 'buying'], category: 'Grammar' },
      { formula: 'Who is ___ tallest boy in the class?', correct: 'the', choices: ['a', 'an', 'the', 'more'], category: 'Grammar' }
    ],
    medium: [
      { formula: 'If I ___ rich, I would buy a car.', correct: 'were', choices: ['am', 'was', 'were', 'will be'], category: 'Grammar' },
      { formula: 'He has been living here ___ three years.', correct: 'for', choices: ['since', 'for', 'during', 'ago'], category: 'Grammar' },
      { formula: 'Neither of the boys ___ present at the meeting.', correct: 'was', choices: ['was', 'were', 'are', 'be'], category: 'Grammar' },
      { formula: 'The book ___ she wrote became a bestseller.', correct: 'which', choices: ['who', 'whom', 'whose', 'which'], category: 'Grammar' },
      { formula: 'This is the ___ test I have ever taken.', correct: 'hardest', choices: ['hard', 'harder', 'hardest', 'most hard'], category: 'Grammar' }
    ],
    hard: [
      { formula: 'By the time we arrived, they ___ already left.', correct: 'had', choices: ['have', 'has', 'had', 'would'], category: 'Grammar' },
      { formula: 'Having ___ his homework, he went to bed.', correct: 'finished', choices: ['finish', 'finishing', 'finished', 'finishes'], category: 'Grammar' },
      { formula: 'She is the girl ___ book I borrowed.', correct: 'whose', choices: ['who', 'whom', 'whose', 'which'], category: 'Grammar' },
      { formula: 'Hardly ___ I entered the room when the phone rang.', correct: 'had', choices: ['have', 'had', 'did', 'was'], category: 'Grammar' }
    ]
  }
};

function applyTemplateVariation(q) {
  const spellingTemplates = [
    "Choose the correct spelling of '{correct}':",
    "Which of the following is the correct spelling for '{correct}'?",
    "Identify the correct spelling: '{correct}'"
  ];
  const vocabTemplates = [
    "What does the word '{correct}' mean?",
    "Choose the correct definition of the word '{correct}':",
    "Select the closest definition for the word '{correct}':"
  ];

  let formula = q.formula;
  if (q.category === 'Spelling') {
    if (!q.formula.includes('🍌') && !q.formula.includes('🐱') && !q.formula.includes('🐶') && !q.formula.includes('🏫')) {
      const template = spellingTemplates[Math.floor(Math.random() * spellingTemplates.length)];
      formula = template.replace('{correct}', q.correct);
    }
  } else if (q.category === 'Vocabulary') {
    if (!q.formula.includes('opposite') && !q.formula.includes('synonym') && !q.formula.includes('antonym') && !q.formula.includes('called a')) {
      const template = vocabTemplates[Math.floor(Math.random() * vocabTemplates.length)];
      formula = template.replace('{correct}', q.correct);
    }
  }
  return formula;
}

export function generateEnglishQuestion(topicId, difficulty) {
  const pool = ENGLISH_DATABASE[topicId] && ENGLISH_DATABASE[topicId][difficulty]
    ? ENGLISH_DATABASE[topicId][difficulty]
    : ENGLISH_DATABASE['spelling']['easy'];

  const q = pool[Math.floor(Math.random() * pool.length)];
  const formulaWithVariation = applyTemplateVariation(q);

  return {
    formula: formulaWithVariation,
    correct: q.correct,
    choices: [...q.choices].sort(() => Math.random() - 0.5),
    category: q.category
  };
}

export function injectApprovedQuestion(topicId, difficulty, questionObj) {
  if (!ENGLISH_DATABASE[topicId]) {
    ENGLISH_DATABASE[topicId] = { easy: [], medium: [], hard: [] };
  }
  if (!ENGLISH_DATABASE[topicId][difficulty]) {
    ENGLISH_DATABASE[topicId][difficulty] = [];
  }
  
  const exists = ENGLISH_DATABASE[topicId][difficulty].some(q => q.formula === questionObj.formula);
  if (!exists) {
    ENGLISH_DATABASE[topicId][difficulty].push({
      formula: questionObj.formula,
      correct: questionObj.correct,
      choices: questionObj.choices,
      category: questionObj.category
    });
  }
}
