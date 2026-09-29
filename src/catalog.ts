export type Challenge = {
  id: string;
  version: number;
  title: string;
  category: string;
  brief: string;
  criteria: string[];
  pass_mark: number;
  max_attempts: number;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  difficulty: 'Starter' | 'Intermediate' | 'Advanced';
  time: string;
  accent: string;
  mark: string;
};

export const starterChallenges: Challenge[] = [
  {
    id: 'support-clarity-v1',
    version: 1,
    title: 'Calm the refund storm',
    category: 'Customer support',
    brief:
      'A customer says an order arrived 21 days ago and no longer fits. The public policy allows returns within 30 days when the item is unworn. Write a helpful response that explains the next step without inventing facts.',
    criteria: [
      'Accurately applies the stated 30-day, unworn-item policy.',
      'Shows empathy without admitting invented facts or promising an outcome.',
      'Gives a concrete and practical next step.',
      'Uses clear, concise and respectful language.',
    ],
    pass_mark: 70,
    max_attempts: 3,
    status: 'OPEN',
    difficulty: 'Starter',
    time: '8 min',
    accent: '#ff8f5c',
    mark: '01',
  },
  {
    id: 'product-story-v1',
    version: 1,
    title: 'Make the complex feel obvious',
    category: 'Product storytelling',
    brief:
      'Explain a wallet safety feature to someone using a crypto product for the first time. Stay under 140 words, avoid fear-based language, and end with one action they can take now.',
    criteria: [
      'Explains the feature accurately for a first-time user.',
      'Uses plain language and avoids unexplained jargon.',
      'Stays within 140 words and avoids fear-based framing.',
      'Ends with one specific, useful action.',
    ],
    pass_mark: 75,
    max_attempts: 3,
    status: 'OPEN',
    difficulty: 'Intermediate',
    time: '12 min',
    accent: '#b7f36b',
    mark: '02',
  },
  {
    id: 'community-call-v1',
    version: 1,
    title: 'Resolve the grey area',
    category: 'Community judgment',
    brief:
      'A community post is sharp and critical but contains no threats or personal data. Decide whether it should stay, be edited, or be removed using the published conduct rules, and explain the decision.',
    criteria: [
      'Makes one clear moderation decision.',
      'Applies only the facts and conduct rules provided.',
      'Separates criticism from harassment or safety concerns.',
      'Explains the decision in a way the author can act on.',
    ],
    pass_mark: 80,
    max_attempts: 2,
    status: 'OPEN',
    difficulty: 'Advanced',
    time: '15 min',
    accent: '#8d7cff',
    mark: '03',
  },
];
