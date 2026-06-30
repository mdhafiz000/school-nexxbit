export const SUBJECT_REGISTRY = {
  math: {
    id: "math",
    name: "Mathematics Focus",
    emoji: "📐",
    description: "Train numerical reasoning, arithmetic, and problem solving.",
    topics: [
      { id: "add", name: "Addition", icon: "➕", defaultEnabled: true },
      { id: "subtract", name: "Subtraction", icon: "➖", defaultEnabled: true },
      { id: "multiply", name: "Multiplication", icon: "✖️", defaultEnabled: true },
      { id: "divide", name: "Division", icon: "➗", defaultEnabled: false }
    ],
    difficultyPresets: {
      easy: { min: 1, max: 9 },
      medium: { min: 10, max: 99 },
      hard: { min: 100, max: 999 }
    }
  },
  english: {
    id: "english",
    name: "English Language Focus",
    emoji: "📖",
    description: "Improve spelling, build vocabulary, and master grammar rules.",
    topics: [
      { id: "spelling", name: "Spelling", icon: "✏️", defaultEnabled: true },
      { id: "vocabulary", name: "Vocabulary", icon: "📖", defaultEnabled: true },
      { id: "grammar", name: "Grammar", icon: "📝", defaultEnabled: false }
    ],
    difficultyPresets: {
      easy: { length: [3, 5] },
      medium: { length: [5, 8] },
      hard: { length: [8, 12] }
    }
  }
};
