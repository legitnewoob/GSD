import { format, subDays } from 'date-fns';
import { CATEGORIES, HABITS, MOODS, ENERGY } from './constants';

export function createEmptyEntry(date = new Date()) {
  const habits = {};
  HABITS.forEach((h) => (habits[h.key] = false));

  const categoryHours = {};
  CATEGORIES.forEach((c) => (categoryHours[c.key] = ''));

  return {
    id: format(date, 'yyyy-MM-dd'),
    date: format(date, 'yyyy-MM-dd'),
    day: format(date, 'EEEE'),
    habits,
    mood: '',
    energy: '',
    productivity: '',
    categoryHours,
    screenTime: '',
    money: '',
    runWalk: '',
    steps: '',
    bigWin: '',
    drain: '',
    tomorrow: '',
    notes: '',
  };
}

const demoHabits = [
  [true, true, true, false, true, true, false, true, true, true],
  [true, true, true, true, true, true, false, true, true, true],
  [true, false, true, true, true, false, false, true, false, true],
  [true, true, true, true, true, true, true, true, true, true],
  [false, false, true, false, true, false, false, false, true, false],
  [true, true, true, false, true, true, false, true, true, true],
  [true, true, false, true, true, true, true, true, true, true],
];

const demoCategoryHours = [
  [3.0, 4.5, 1.0, 0.5, 7.5, 2.0, 1.0, 1.5, 1.0, 1.0, 0.5],
  [4.0, 5.0, 0.5, 1.0, 8.0, 1.5, 2.0, 1.0, 1.0, 0.5, 0.5],
  [2.5, 3.0, 1.5, 0.0, 7.0, 2.5, 1.5, 2.0, 1.5, 1.0, 1.5],
  [5.0, 4.0, 1.0, 0.5, 7.5, 1.0, 2.5, 0.5, 1.0, 0.5, 0.0],
  [1.0, 6.0, 0.0, 0.0, 6.5, 2.0, 0.5, 3.0, 1.0, 1.0, 2.0],
  [3.5, 4.0, 1.0, 0.5, 7.0, 2.0, 1.0, 1.5, 1.0, 1.0, 0.5],
  [4.0, 3.5, 2.0, 1.0, 8.0, 2.5, 2.0, 1.0, 1.0, 0.0, 0.0],
];

const demoMoods = ['4', '5 - Great', '3 - Okay', '5 - Great', '2', '4', '3 - Okay'];
const demoEnergy = ['4', '5 - High', '3 - Average', '4', '2', '3 - Average', '4'];
const demoProductivity = [7, 8, 6, 9, 4, 7, 8];
const demoScreen = [3.5, 2.5, 4.0, 2.0, 5.0, 3.0, 2.5];
const demoMoney = [200, 150, 300, 120, 450, 180, 220];
const demoRun = [3.0, 5.0, 0.0, 2.5, 0.0, 4.0, 3.5];
const demoSteps = [8000, 10500, 4500, 7200, 3000, 9000, 8500];
const demoReflections = [
  ['Shipped project draft', 'Long commute', 'Deep-work block in morning'],
  ['Gym + run', 'Back-to-back calls', 'Plan learning hour'],
  ['Cleared inbox', 'Low focus afternoon', 'No screens after 9pm'],
  ['Hit all habits', 'None really', 'Keep the streak'],
  ['Finished report', 'Too much entertainment', 'Prioritise sleep'],
  ['Read 30 min', 'Unexpected errands', 'Time-block tomorrow'],
  ['Family dinner', 'Worked late', 'Wake up early'],
];

export function generateDemoData() {
  const entries = [];
  for (let i = 0; i < 7; i++) {
    const date = subDays(new Date(), 6 - i);
    const entry = createEmptyEntry(date);
    HABITS.forEach((h, idx) => (entry.habits[h.key] = demoHabits[i][idx]));
    CATEGORIES.forEach((c, idx) => (entry.categoryHours[c.key] = demoCategoryHours[i][idx]));
    entry.mood = demoMoods[i];
    entry.energy = demoEnergy[i];
    entry.productivity = demoProductivity[i];
    entry.screenTime = demoScreen[i];
    entry.money = demoMoney[i];
    entry.runWalk = demoRun[i];
    entry.steps = demoSteps[i];
    [entry.bigWin, entry.drain, entry.tomorrow] = demoReflections[i];
    entries.push(entry);
  }
  return entries;
}
