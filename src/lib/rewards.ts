// Reward suggestions: turns the blank "treat yourself" field into a tap.
// No AI involved — the Gemini key is currently dead (see CLAUDE.md), and a
// curated list is honestly enough for "what's something I'd enjoy?"

export const REWARD_TAGS = [
  "Food & drink",
  "A show or movie",
  "Shopping",
  "Outdoors",
  "Rest & downtime",
  "Games",
  "Social",
  "Music",
  "Something new",
] as const;

export type RewardTag = (typeof REWARD_TAGS)[number];

const SUGGESTIONS: Record<RewardTag, readonly string[]> = {
  "Food & drink": [
    "Order your favorite takeout",
    "Try a new restaurant",
    "Bake something you've been meaning to",
    "Get that specialty coffee or tea",
  ],
  "A show or movie": [
    "Watch the next episode, guilt-free",
    "Start the show everyone's talking about",
    "Movie night, no chores after",
  ],
  Shopping: [
    "Get that thing you've been eyeing",
    "Treat yourself to something small",
    "Upgrade one piece of gear you use daily",
  ],
  Outdoors: [
    "Take a walk somewhere new",
    "A hike or trail you haven't done",
    "Sit outside with no phone for 20 minutes",
  ],
  "Rest & downtime": [
    "Sleep in this weekend",
    "A lazy morning, no alarm",
    "An early night with a book",
  ],
  Games: [
    "An hour of guilt-free gaming",
    "Play the game you haven't touched in a while",
  ],
  Social: [
    "Call a friend you've been meaning to catch up with",
    "Plan a hangout",
    "Text someone your good news",
  ],
  Music: [
    "Go to a show or concert",
    "A full listen-through of a new album",
  ],
  "Something new": [
    "Try something you've never done before",
    "Sign up for that class",
    "Explore a new part of town",
  ],
};

const PREFS_KEY = "alfred.rewardPrefs";

export function getRewardPrefs(): RewardTag[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is RewardTag => (REWARD_TAGS as readonly string[]).includes(t));
  } catch {
    return [];
  }
}

export function setRewardPrefs(tags: RewardTag[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(tags));
  } catch {
    /* quota */
  }
}

export function toggleRewardPref(tag: RewardTag): RewardTag[] {
  const current = getRewardPrefs();
  const next = current.includes(tag)
    ? current.filter((t) => t !== tag)
    : [...current, tag];
  setRewardPrefs(next);
  return next;
}

function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks `count` concrete reward ideas. Matches the user's saved tags when
 * they've set any; falls back to the full pool otherwise so the feature
 * still works before anyone has told Alfred what they like.
 */
export function suggestRewards(
  tags: RewardTag[] = getRewardPrefs(),
  count = 3,
  rand: () => number = Math.random,
): string[] {
  const pool = tags.length > 0 ? tags : REWARD_TAGS;
  const all = pool.flatMap((tag) => SUGGESTIONS[tag]);
  return shuffle(all, rand).slice(0, count);
}
