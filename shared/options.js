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
