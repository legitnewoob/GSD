export const defaultHabits = [
  { key: 'wake_up_6am', label: 'Wake up on time 6 am' },
  { key: 'no_phone_after_waking', label: 'No phone after waking' },
  { key: 'plan_big_3', label: 'Plan big 3' },
  { key: 'dsa', label: 'DSA' },
  { key: 'codeforces_cp', label: 'Codeforces / CP' },
  { key: 'codeforces_contest', label: 'Codeforces Contest' },
  { key: 'codechef_contest', label: 'Codechef Contest' },
  { key: 'atcoder_contest', label: 'Atcoder Contest' },
  { key: 'leetcode_contest', label: 'Leetcode Contest' },
  { key: 'dev_practice', label: 'Development Practice' },
  { key: 'system_design', label: 'System Design Prep' },
  { key: 'freelance_project', label: 'Freelance Project' },
  { key: 'gym', label: 'Gym' },
  { key: 'run', label: 'Run' },
  { key: 'nutrition_target', label: 'Nutrition Target' },
  { key: 'water_target', label: 'Water Target' },
  { key: 'no_porn', label: 'No Porn' },
  { key: 'no_masturbation', label: 'No Masturbation' },
  { key: 'social_media_limit', label: 'Social Media within Limit' },
  { key: 'read', label: 'Read' },
  { key: 'journal', label: 'Journal' },
  { key: 'ten_min_reset', label: '10-mins reset' },
  { key: 'night_shutdown', label: 'Night Shutdown' },
  { key: 'bed_on_time', label: 'Bed on time' },
  { key: 'brush_twice', label: 'Brush Twice' },
  { key: 'fix_posture', label: 'Fix Posture' },
  { key: 'self_care', label: 'Self Care' },
  { key: 'hair_care', label: 'Hair care medication' },
  { key: 'spend_under_budget', label: 'Spend under budget' },
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
