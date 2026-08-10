export const defaultHabits = [
  { key: 'wake_on_time', label: 'Wake on time' },
  { key: 'workout', label: 'Workout / Run' },
  { key: 'deep_work', label: 'Deep work' },
  { key: 'learning', label: 'Learning' },
  { key: 'read', label: 'Read' },
  { key: 'hydration', label: 'Hydration' },
  { key: 'nutrition', label: 'Good nutrition' },
  { key: 'spend_logged', label: 'Spend logged' },
  { key: 'limited_scrolling', label: 'Limited scrolling' },
  { key: 'evening_review', label: 'Evening review' },
];

export const defaultCategories = [
  { key: 'deep_work', label: 'Deep Work', color: '#f59e0b', expectedHours: 4 },
  { key: 'work_admin', label: 'Work / Admin', color: '#3b82f6', expectedHours: 4 },
  { key: 'learning', label: 'Learning', color: '#22c55e', expectedHours: 1 },
  { key: 'exercise', label: 'Exercise', color: '#ef4444', expectedHours: 1 },
  { key: 'sleep', label: 'Sleep', color: '#8b5cf6', expectedHours: 7.5 },
  { key: 'personal', label: 'Personal', color: '#06b6d4', expectedHours: 1.5 },
  { key: 'social', label: 'Social', color: '#ec4899', expectedHours: 1 },
  { key: 'entertainment', label: 'Entertainment', color: '#6366f1', expectedHours: 1 },
  { key: 'chores', label: 'Chores', color: '#84cc16', expectedHours: 1 },
  { key: 'commute', label: 'Commute', color: '#14b8a6', expectedHours: 1 },
  { key: 'unplanned', label: 'Unplanned', color: '#9ca3af', expectedHours: 0.5 },
];

export const specialCategoryKeys = {
  sleep: 'sleep',
  exercise: 'exercise',
  deepWork: 'deep_work',
  unplanned: 'unplanned',
};

export const moodOptions = [
  { label: '1 — Low / heavy', value: 1 },
  { label: '2 — Off', value: 2 },
  { label: '3 — Okay / steady', value: 3 },
  { label: '4 — Good / upbeat', value: 4 },
  { label: '5 — Great / glowing', value: 5 },
];

export const energyOptions = [
  { label: '1 — Drained', value: 1 },
  { label: '2 — Tired', value: 2 },
  { label: '3 — Average', value: 3 },
  { label: '4 — Energized', value: 4 },
  { label: '5 — Unstoppable', value: 5 },
];

export const powerOptions = [
  { label: '1 — Distracted', value: 1 },
  { label: '2 — Slow', value: 2 },
  { label: '3 — Steady', value: 3 },
  { label: '4 — Focused', value: 4 },
  { label: '5 — Flow state', value: 5 },
];

export function findOption(options, value) {
  return options.find((o) => o.value === value) || null;
}
