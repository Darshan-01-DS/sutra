export const AVAILABLE_INTENTS = [
  'Watch Later',
  'Deep Read',
  'Code Reference',
  'Research Paper',
  'Tweet / Thread',
  'Learn',
  'PDF Document',
  'Video',
  'Discussion',
  'Article',
  'Hackathon Idea',
  'Note to Self'
] as const;

export type IntentLabel = (typeof AVAILABLE_INTENTS)[number];

export type IntentIconName =
  | 'play'
  | 'code'
  | 'beaker'
  | 'book'
  | 'x'
  | 'bubble'
  | 'lightbulb'
  | 'document'
  | 'newspaper'
  | 'spark'
  | 'note';

export interface IntentDefinition {
  label: IntentLabel;
  icon: IntentIconName;
}

export interface IntentDetectionInput {
  url: string;
  title: string;
  wordCount: number;
  hasArticle: boolean;
  hasVideo: boolean;
  isPdf: boolean;
}

const INTENT_META: Record<IntentLabel, IntentDefinition> = {
  'Watch Later': { label: 'Watch Later', icon: 'play' },
  'Deep Read': { label: 'Deep Read', icon: 'book' },
  'Code Reference': { label: 'Code Reference', icon: 'code' },
  'Research Paper': { label: 'Research Paper', icon: 'beaker' },
  'Tweet / Thread': { label: 'Tweet / Thread', icon: 'x' },
  'Learn': { label: 'Learn', icon: 'lightbulb' },
  'PDF Document': { label: 'PDF Document', icon: 'document' },
  'Video': { label: 'Video', icon: 'play' },
  'Discussion': { label: 'Discussion', icon: 'bubble' },
  'Article': { label: 'Article', icon: 'newspaper' },
  'Hackathon Idea': { label: 'Hackathon Idea', icon: 'spark' },
  'Note to Self': { label: 'Note to Self', icon: 'note' }
};

export function getIntentMeta(label: IntentLabel): IntentDefinition {
  return INTENT_META[label];
}

export function detectIntent(input: IntentDetectionInput): IntentDefinition {
  const normalizedUrl = input.url.toLowerCase();
  const normalizedTitle = input.title.toLowerCase();

  if (normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be')) {
    return INTENT_META['Watch Later'];
  }

  if (normalizedUrl.includes('github.com')) {
    return INTENT_META['Code Reference'];
  }

  if (
    normalizedUrl.includes('arxiv.org') ||
    normalizedUrl.includes('scholar.google') ||
    normalizedUrl.includes('pubmed') ||
    normalizedUrl.includes('semanticscholar')
  ) {
    return INTENT_META['Research Paper'];
  }

  if (input.hasArticle && input.wordCount > 800) {
    return INTENT_META['Deep Read'];
  }

  if (input.wordCount < 400 && (normalizedUrl.includes('twitter.com') || normalizedUrl.includes('x.com'))) {
    return INTENT_META['Tweet / Thread'];
  }

  if (normalizedUrl.includes('reddit.com')) {
    return INTENT_META['Discussion'];
  }

  if (/\b(tutorial|how to|guide|learn)\b/.test(normalizedTitle)) {
    return INTENT_META['Learn'];
  }

  if (input.isPdf || normalizedUrl.endsWith('.pdf')) {
    return INTENT_META['PDF Document'];
  }

  if (input.hasVideo) {
    return INTENT_META['Video'];
  }

  return INTENT_META['Article'];
}

export function getIntentOptions(primaryLabel: IntentLabel, hasSelectedText: boolean): IntentDefinition[] {
  const options = new Set<IntentLabel>([primaryLabel]);
  const preferred: IntentLabel[] = hasSelectedText
    ? ['Note to Self', 'Deep Read', 'Learn', 'Article']
    : ['Article', 'Note to Self', 'Hackathon Idea', 'Deep Read'];

  for (const label of preferred) {
    if (label !== primaryLabel) {
      options.add(label);
    }
    if (options.size >= 5) {
      break;
    }
  }

  for (const label of AVAILABLE_INTENTS) {
    options.add(label);
    if (options.size >= 5) {
      break;
    }
  }

  return Array.from(options).map((label) => INTENT_META[label]);
}

export function mapIntentToSignalType(
  intent: IntentLabel,
  isPdf: boolean,
  hasVideo: boolean,
  url: string
): 'article' | 'video' | 'tweet' | 'pdf' | 'note' | 'image' {
  if (intent === 'Tweet / Thread') {
    return 'tweet';
  }

  if (intent === 'Note to Self' || intent === 'Hackathon Idea') {
    return 'note';
  }

  if (intent === 'PDF Document' || isPdf || url.toLowerCase().endsWith('.pdf')) {
    return 'pdf';
  }

  if (intent === 'Watch Later' || intent === 'Video' || hasVideo) {
    return 'video';
  }

  return 'article';
}