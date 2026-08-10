import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { defaultHabits, defaultCategories } from '../../shared/constants.js';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';
const FRONTEND_URL = process.env.FRONTEND_URL;

const allowedOrigins = FRONTEND_URL ? [FRONTEND_URL, 'http://localhost:5173'] : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

async function getOrCreateUser() {
  let user = await prisma.user.findUnique({ where: { id: DEFAULT_USER_ID } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: DEFAULT_USER_ID,
        name: 'Hero',
      },
    });
    await prisma.habit.createMany({
      data: defaultHabits.map((h, i) => ({
        userId: user.id,
        name: h.label,
        order: i,
      })),
    });
    await prisma.category.createMany({
      data: defaultCategories.map((c, i) => ({
        userId: user.id,
        key: c.key,
        name: c.label,
        color: c.color,
        expectedHours: c.expectedHours,
        order: i,
      })),
    });
  }
  return user;
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/config', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    const [habits, categories, budgetSetting, todos] = await Promise.all([
      prisma.habit.findMany({ where: { userId: user.id, isActive: true }, orderBy: { order: 'asc' } }),
      prisma.category.findMany({ where: { userId: user.id, isActive: true }, orderBy: { order: 'asc' } }),
      prisma.budgetSetting.findUnique({ where: { userId: user.id } }),
      prisma.todo.findMany({ where: { userId: user.id, completed: false }, orderBy: { createdAt: 'asc' } }),
    ]);
    res.json({ user, habits, categories, budgetSetting, todos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/entries', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    const entries = await prisma.entry.findMany({
      where: { userId: user.id },
      include: { habits: { include: { habit: true } }, categories: { include: { category: true } } },
      orderBy: { date: 'asc' },
    });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/entries', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    const payload = req.body;
    const date = payload.date;

    const entryData = {
      userId: user.id,
      date,
      day: payload.day || null,
      moodLabel: payload.mood?.label || null,
      moodScore: payload.mood?.value ?? null,
      energyLabel: payload.energy?.label || null,
      energyScore: payload.energy?.value ?? null,
      powerLabel: payload.power?.label || null,
      powerScore: payload.power?.value ?? null,
      screenTime: payload.screenTime === '' ? null : payload.screenTime ?? null,
      money: payload.money === '' ? null : payload.money ?? null,
      runWalk: payload.runWalk === '' ? null : payload.runWalk ?? null,
      steps: payload.steps === '' ? null : payload.steps ?? null,
      bigWin: payload.bigWin || null,
      drain: payload.drain || null,
      tomorrow: payload.tomorrow || null,
      notes: payload.notes || null,
    };

    const entry = await prisma.entry.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: entryData,
      update: entryData,
    });

    if (payload.habits) {
      await prisma.entryHabit.deleteMany({ where: { entryId: entry.id } });
      const habitRows = Object.entries(payload.habits)
        .filter(([, completed]) => completed != null)
        .map(([habitId, completed]) => ({ entryId: entry.id, habitId, completed: Boolean(completed) }));
      if (habitRows.length) await prisma.entryHabit.createMany({ data: habitRows });
    }

    if (payload.categories) {
      await prisma.entryCategory.deleteMany({ where: { entryId: entry.id } });
      const catRows = Object.entries(payload.categories)
        .filter(([, hours]) => hours !== '' && hours != null)
        .map(([categoryId, hours]) => ({ entryId: entry.id, categoryId, hours: parseFloat(hours) }));
      if (catRows.length) await prisma.entryCategory.createMany({ data: catRows });
    }

    const updated = await prisma.entry.findUnique({
      where: { id: entry.id },
      include: { habits: { include: { habit: true } }, categories: { include: { category: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/entries/:id', async (req, res) => {
  try {
    await prisma.entry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/habits', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    const { id, name, order, xpValue } = req.body;
    const habit = await prisma.habit.upsert({
      where: { id: id || 'new' },
      create: { userId: user.id, name, order: order ?? 0, xpValue: xpValue ?? 5 },
      update: { name, order: order ?? 0, xpValue: xpValue ?? 5 },
    });
    res.json(habit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/habits/:id', async (req, res) => {
  try {
    await prisma.habit.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    const { id, key, name, color, expectedHours, order } = req.body;
    const category = await prisma.category.upsert({
      where: { id: id || 'new' },
      create: { userId: user.id, key: key || null, name, color, expectedHours: expectedHours ?? null, order: order ?? 0 },
      update: { key: key || null, name, color, expectedHours: expectedHours ?? null, order: order ?? 0 },
    });
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/budget', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    const [entries, budgetSetting] = await Promise.all([
      prisma.entry.findMany({ where: { userId: user.id }, select: { date: true, money: true }, orderBy: { date: 'asc' } }),
      prisma.budgetSetting.findUnique({ where: { userId: user.id } }),
    ]);
    res.json({ entries, budgetSetting });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/budget', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    const { dailyLimit, monthlyLimit } = req.body;
    const budget = await prisma.budgetSetting.upsert({
      where: { userId: user.id },
      create: { userId: user.id, dailyLimit, monthlyLimit },
      update: { dailyLimit, monthlyLimit },
    });
    res.json(budget);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/todos', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    const todos = await prisma.todo.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    res.json(todos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/todos', async (req, res) => {
  try {
    const user = await getOrCreateUser();
    const { text } = req.body;
    const todo = await prisma.todo.create({
      data: { userId: user.id, text },
    });
    res.json(todo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/todos/:id', async (req, res) => {
  try {
    const { text, completed } = req.body;
    const todo = await prisma.todo.update({
      where: { id: req.params.id },
      data: { text, completed },
    });
    res.json(todo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  try {
    await prisma.todo.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
