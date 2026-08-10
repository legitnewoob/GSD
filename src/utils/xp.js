import { specialCategoryKeys, XP_LEVEL_THRESHOLD } from './constants';

function getHoursByKey(categories, key) {
  if (!categories) return 0;
  if (Array.isArray(categories)) {
    const found = categories.find((c) => c.category?.key === key || c.key === key);
    return found ? parseFloat(found.hours ?? found.categoryHours ?? 0) : 0;
  }
  const found = Object.values(categories).find((c) => c.key === key);
  return found ? parseFloat(found.hours ?? 0) : 0;
}

export function calculateEntryXp(entry, habitsConfig = [], categoriesConfig = []) {
  let habitXp = 0;
  if (entry.habits) {
    const ids = Object.keys(entry.habits).filter((id) => entry.habits[id]);
    habitXp = ids.reduce((sum, id) => {
      const hcfg = habitsConfig.find((h) => h.id === id);
      return sum + (hcfg?.xpValue || 5);
    }, 0);
  }

  const powerXp = (entry.power?.value || 0) * 10;

  const sleep = getHoursByKey(entry.categories || entry.categoryHours, specialCategoryKeys.sleep);
  let sleepXp = 0;
  if (sleep >= 7) sleepXp = 15;
  else if (sleep >= 6) sleepXp = 8;
  else if (sleep > 0) sleepXp = 3;

  const exercise = getHoursByKey(entry.categories || entry.categoryHours, specialCategoryKeys.exercise);
  const exerciseMinutes = exercise * 60;
  let exerciseXp = 0;
  if (exerciseMinutes >= 30) exerciseXp = 10;
  else if (exerciseMinutes >= 10) exerciseXp = 5;

  const healthXp = sleepXp + exerciseXp;

  const deepWork = getHoursByKey(entry.categories || entry.categoryHours, specialCategoryKeys.deepWork);
  const focusXp = Math.min(30, deepWork * 5);

  const { bigWin, drain, tomorrow } = entry;
  let reflectionXp = 0;
  if (bigWin && drain && tomorrow) reflectionXp = 15;
  else if (bigWin || drain || tomorrow) reflectionXp = 5;

  const unplanned = getHoursByKey(entry.categories || entry.categoryHours, specialCategoryKeys.unplanned);
  const allHours = Array.isArray(entry.categories)
    ? entry.categories.reduce((sum, c) => sum + (parseFloat(c.hours ?? c.categoryHours) || 0), 0)
    : Object.values(entry.categories || entry.categoryHours || {}).reduce(
        (sum, c) => sum + (parseFloat(typeof c === 'object' ? c.hours : c) || 0),
        0
      );
  const intentional = allHours - unplanned;
  const bonusXp = intentional > 0 && unplanned >= 0 && intentional > unplanned ? 10 : 0;

  const total = habitXp + powerXp + healthXp + focusXp + reflectionXp + bonusXp;

  return {
    habit: habitXp,
    power: powerXp,
    health: healthXp,
    focus: focusXp,
    reflection: reflectionXp,
    bonus: bonusXp,
    total,
  };
}

export function computeLevels(entries, habitsConfig, categoriesConfig) {
  let cumulative = 0;
  return entries.map((entry) => {
    const xp = calculateEntryXp(entry, habitsConfig, categoriesConfig);
    cumulative += xp.total;
    return {
      ...entry,
      xp,
      cumulativeXp: cumulative,
      level: Math.floor(cumulative / XP_LEVEL_THRESHOLD) + 1,
    };
  });
}

export function questStatus(dailyXp) {
  if (dailyXp >= 80) return '🏆 Complete';
  if (dailyXp >= 50) return '⭐ Good';
  return '○ In progress';
}
