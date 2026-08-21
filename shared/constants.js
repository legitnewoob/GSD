export const defaultHabits = [
  // Morning
  { key: 'wake_up_6am',           label: 'Wake up on time 6 am',      group: 'Morning' },
  { key: 'no_phone_after_waking', label: 'No phone after waking',      group: 'Morning' },
  { key: 'plan_big_3',            label: 'Plan big 3',                 group: 'Morning' },
  { key: 'brush_twice',           label: 'Brush Twice',                group: 'Morning' },
  // CP & DSA
  { key: 'dsa',                   label: 'DSA',                        group: 'CP & DSA' },
  { key: 'codeforces_cp',         label: 'Codeforces / CP',            group: 'CP & DSA' },
  { key: 'codeforces_contest',    label: 'Codeforces Contest',         group: 'CP & DSA' },
  { key: 'codechef_contest',      label: 'Codechef Contest',           group: 'CP & DSA' },
  { key: 'atcoder_contest',       label: 'Atcoder Contest',            group: 'CP & DSA' },
  { key: 'leetcode_contest',      label: 'Leetcode Contest',           group: 'CP & DSA' },
  // Tech & Career
  { key: 'dev_practice',          label: 'Development Practice',       group: 'Tech & Career' },
  { key: 'system_design',         label: 'System Design Prep',         group: 'Tech & Career' },
  { key: 'ai_engineering',        label: 'AI Engineering Prep',        group: 'Tech & Career' },
  { key: 'freelance_project',     label: 'Freelance Project',          group: 'Tech & Career' },
  // Fitness
  { key: 'gym',                   label: 'Gym',                        group: 'Fitness' },
  { key: 'run',                   label: 'Run',                        group: 'Fitness' },
  { key: 'walk',                  label: 'Walk',                       group: 'Fitness' },
  { key: 'nutrition_target',      label: 'Nutrition Target',           group: 'Fitness' },
  { key: 'water_target',          label: 'Water Target',               group: 'Fitness' },
  // Discipline
  { key: 'no_porn',               label: 'No Porn',                    group: 'Discipline' },
  { key: 'no_masturbation',       label: 'No Masturbation',            group: 'Discipline' },
  { key: 'social_media_limit',    label: 'Social Media within Limit',  group: 'Discipline' },
  { key: 'no_scar_cream',         label: 'No Scar Cream',              group: 'Discipline' },
  { key: 'spend_under_budget',    label: 'Spend under budget',         group: 'Discipline' },
  // Mind & Growth
  { key: 'read',                  label: 'Read',                       group: 'Mind & Growth' },
  { key: 'journal',               label: 'Journal',                    group: 'Mind & Growth' },
  { key: 'ten_min_reset',         label: '10-mins reset',              group: 'Mind & Growth' },
  // Self Care
  { key: 'fix_posture',           label: 'Fix Posture',                group: 'Self Care' },
  { key: 'hair_care',             label: 'Hair care medication',       group: 'Self Care' },
  { key: 'self_care',             label: 'Self Care',                  group: 'Self Care' },
  { key: 'shower',                label: 'Shower',                     group: 'Self Care' },
  // Night
  { key: 'night_shutdown',        label: 'Night Shutdown',             group: 'Night' },
  { key: 'bed_on_time',           label: 'Bed on time',                group: 'Night' },
];

export const HABIT_GROUP_ORDER = [
  'Morning',
  'CP & DSA',
  'Tech & Career',
  'Fitness',
  'Discipline',
  'Mind & Growth',
  'Self Care',
  'Night',
  'Other',
];

const _habitNameToGroup = Object.fromEntries(
  defaultHabits.map((h) => [h.label.toLowerCase(), h.group])
);

export function getHabitGroup(habitName) {
  return _habitNameToGroup[habitName?.toLowerCase()] || 'Other';
}

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
  { label: '1 — Low / heavy',   short: 'Low',    value: 1 },
  { label: '2 — Off',           short: 'Off',    value: 2 },
  { label: '3 — Okay / steady', short: 'Okay',   value: 3 },
  { label: '4 — Good / upbeat', short: 'Good',   value: 4 },
  { label: '5 — Great / glowing', short: 'Great', value: 5 },
];

export const energyOptions = [
  { label: '1 — Drained',      short: 'Drained',  value: 1 },
  { label: '2 — Tired',        short: 'Tired',    value: 2 },
  { label: '3 — Average',      short: 'Average',  value: 3 },
  { label: '4 — Energized',    short: 'Pumped',   value: 4 },
  { label: '5 — Unstoppable',  short: 'Top',      value: 5 },
];

export const powerOptions = [
  { label: '1 — Distracted',  short: 'Lost',    value: 1 },
  { label: '2 — Slow',        short: 'Slow',    value: 2 },
  { label: '3 — Steady',      short: 'Steady',  value: 3 },
  { label: '4 — Focused',     short: 'Focused', value: 4 },
  { label: '5 — Flow state',  short: 'Flow',    value: 5 },
];

export function findOption(options, value) {
  return options.find((o) => o.value === value) || null;
}
