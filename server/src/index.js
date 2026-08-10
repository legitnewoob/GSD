import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { defaultHabits, defaultCategories } from '../../shared/constants.js';


const app = express();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});
const PORT = process.env.PORT || 4000;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';
const FRONTEND_URL = process.env.FRONTEND_URL;
const APP_PASSWORD = process.env.APP_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const allowedOrigins = FRONTEND_URL ? [FRONTEND_URL, 'http://localhost:5173'] : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  if (!APP_PASSWORD) {
    req.userId = DEFAULT_USER_ID;
    return next();
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  const payload = verifyToken(token);
  if (!payload || payload.userId !== DEFAULT_USER_ID) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = payload.userId;
  next();
}

async function getOrCreateUser(userId) {
  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: userId,
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

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/login' || req.path === '/auth-status') return next();
  requireAuth(req, res, next);
});

app.get('/api/health', (req, res) => res.json({ ok: true, protected: Boolean(APP_PASSWORD) }));

app.get('/api/auth-status', (req, res) => res.json({ requiresAuth: Boolean(APP_PASSWORD) }));

app.post('/api/login', (req, res) => {
  if (!APP_PASSWORD) return res.json({ token: signToken({ userId: DEFAULT_USER_ID }) });
  const { password } = req.body;
  if (password !== APP_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
  res.json({ token: signToken({ userId: DEFAULT_USER_ID }) });
});

app.get('/api/config', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
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
    const user = await getOrCreateUser(req.userId);
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
    const user = await getOrCreateUser(req.userId);
    const payload = req.body;
    const date = payload.date;

    const entryData = {
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
      create: { userId: user.id, date, ...entryData },
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
    const user = await getOrCreateUser(req.userId);
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
    const user = await getOrCreateUser(req.userId);
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
    const user = await getOrCreateUser(req.userId);
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
    const user = await getOrCreateUser(req.userId);
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
    const user = await getOrCreateUser(req.userId);
    const todos = await prisma.todo.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    res.json(todos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/todos', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
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
