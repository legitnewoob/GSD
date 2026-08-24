import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { defaultHabits, defaultCategories } from '../../shared/constants.js';
import { startReminderScheduler, sendTelegramMessage } from './scheduler.js';

const defaultBudgetCategories = [
  { name: 'Rent', type: 'fixed', budgetedAmount: 18000, order: 0 },
  { name: 'Investments', type: 'fixed', budgetedAmount: 5000, order: 1 },
  { name: 'Subscriptions', type: 'fixed', budgetedAmount: 500, order: 2 },
  { name: 'Food', type: 'daily', budgetedAmount: 4000, order: 3 },
  { name: 'Eating Out', type: 'daily', budgetedAmount: 3000, order: 4 },
  { name: 'Petrol', type: 'daily', budgetedAmount: 1500, order: 5 },
  { name: 'Outings', type: 'daily', budgetedAmount: 2000, order: 6 },
  { name: 'Shopping', type: 'daily', budgetedAmount: 2000, order: 7 },
  { name: 'Medical', type: 'daily', budgetedAmount: 1000, order: 8 },
  { name: 'Emergency', type: 'fixed', budgetedAmount: 2000, order: 9 },
];


const app = express();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});
const PORT = process.env.PORT || 4000;
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';
const APP_PASSWORD = process.env.APP_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/integrations/google-fit/callback';

const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/+$/, '').toLowerCase();

const allowedOrigins = [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header (e.g. server-to-server, curl)
    if (!origin) {
      return callback(null, true);
    }

    // If FRONTEND_URL is unset, allow all origins as a debugging fallback
    if (allowedOrigins.length === 0) {
      console.warn('FRONTEND_URL is not set; allowing all CORS origins for debugging');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin.toLowerCase())) {
      return callback(null, true);
    }

    console.warn(`Blocked CORS origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
  if (
    req.path === '/health' ||
    req.path === '/login' ||
    req.path === '/auth-status' ||
    req.path === '/integrations/google-fit/auth' ||
    req.path === '/integrations/google-fit/callback' ||
    req.path === '/integrations/google-fit/debug'
  ) return next();
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
    const budgetInclude = {
      budgetCategories: { where: { isActive: true }, orderBy: { order: 'asc' } },
      creditCards: { where: { isActive: true }, orderBy: { order: 'asc' } },
    };
    const [habits, categories, todos] = await Promise.all([
      prisma.habit.findMany({ where: { userId: user.id, isActive: true }, orderBy: { order: 'asc' } }),
      prisma.category.findMany({ where: { userId: user.id, isActive: true }, orderBy: { order: 'asc' } }),
      prisma.todo.findMany({ where: { userId: user.id, completed: false }, orderBy: { createdAt: 'asc' } }),
    ]);
    let budgetSetting = await prisma.budgetSetting.findUnique({ where: { userId: user.id }, include: budgetInclude });
    if (!budgetSetting) {
      budgetSetting = await prisma.budgetSetting.create({
        data: { userId: user.id, budgetCategories: { create: defaultBudgetCategories } },
        include: budgetInclude,
      });
    } else if (budgetSetting.budgetCategories.length === 0) {
      await prisma.budgetCategory.createMany({
        data: defaultBudgetCategories.map((c) => ({ ...c, budgetSettingId: budgetSetting.id })),
      });
      budgetSetting = await prisma.budgetSetting.findUnique({ where: { userId: user.id }, include: budgetInclude });
    }
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
    let budgetSetting = await prisma.budgetSetting.findUnique({
      where: { userId: user.id },
      include: {
        budgetCategories: { where: { isActive: true }, orderBy: { order: 'asc' } },
        creditCards: { where: { isActive: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!budgetSetting) {
      budgetSetting = await prisma.budgetSetting.create({
        data: { userId: user.id, budgetCategories: { create: defaultBudgetCategories } },
        include: {
          budgetCategories: { where: { isActive: true }, orderBy: { order: 'asc' } },
          creditCards: { where: { isActive: true }, orderBy: { order: 'asc' } },
        },
      });
    } else if (budgetSetting.budgetCategories.length === 0) {
      await prisma.budgetCategory.createMany({
        data: defaultBudgetCategories.map((c) => ({ ...c, budgetSettingId: budgetSetting.id })),
      });
      budgetSetting = await prisma.budgetSetting.findUnique({
        where: { userId: user.id },
        include: {
          budgetCategories: { where: { isActive: true }, orderBy: { order: 'asc' } },
          creditCards: { where: { isActive: true }, orderBy: { order: 'asc' } },
        },
      });
    }
    const entries = await prisma.entry.findMany({
      where: { userId: user.id },
      select: { date: true, money: true },
      orderBy: { date: 'asc' },
    });
    res.json({ entries, budgetSetting });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/budget', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const { monthlyIncome, cashBalance, bankBalance, salaryDay, lastSalaryCredit } = req.body;
    const data = {};
    if (monthlyIncome !== undefined) data.monthlyIncome = monthlyIncome;
    if (cashBalance !== undefined) data.cashBalance = cashBalance;
    if (bankBalance !== undefined) data.bankBalance = bankBalance;
    if (salaryDay !== undefined) data.salaryDay = salaryDay;
    if (lastSalaryCredit !== undefined) data.lastSalaryCredit = lastSalaryCredit;
    const budget = await prisma.budgetSetting.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
      include: {
        budgetCategories: { where: { isActive: true }, orderBy: { order: 'asc' } },
        creditCards: { where: { isActive: true }, orderBy: { order: 'asc' } },
      },
    });
    res.json(budget);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Budget Categories
app.post('/api/budget/categories', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    let budgetSetting = await prisma.budgetSetting.findUnique({ where: { userId: user.id } });
    if (!budgetSetting) {
      budgetSetting = await prisma.budgetSetting.create({ data: { userId: user.id } });
    }
    const { id, name, type, budgetedAmount, spentAmount, order } = req.body;
    const category = await prisma.budgetCategory.upsert({
      where: { id: id || 'new' },
      create: { budgetSettingId: budgetSetting.id, name, type: type || 'daily', budgetedAmount: budgetedAmount || 0, spentAmount: spentAmount || 0, order: order ?? 0 },
      update: { name, type: type || 'daily', budgetedAmount: budgetedAmount || 0, spentAmount: spentAmount !== undefined ? spentAmount : undefined, order: order ?? 0 },
    });
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/budget/categories/:id', async (req, res) => {
  try {
    await prisma.budgetCategory.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Credit Cards
app.post('/api/budget/credit-cards', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    let budgetSetting = await prisma.budgetSetting.findUnique({ where: { userId: user.id } });
    if (!budgetSetting) {
      budgetSetting = await prisma.budgetSetting.create({ data: { userId: user.id } });
    }
    const { id, name, currentBalance, creditLimit, rewardPoints, isPaid, order } = req.body;
    const balance = isPaid ? 0 : (currentBalance || 0);
    const card = await prisma.creditCard.upsert({
      where: { id: id || 'new' },
      create: { budgetSettingId: budgetSetting.id, name, currentBalance: balance, creditLimit: creditLimit || null, rewardPoints: rewardPoints ?? null, isPaid: isPaid || false, order: order ?? 0 },
      update: { name, currentBalance: balance, creditLimit: creditLimit || null, rewardPoints: rewardPoints ?? null, isPaid: isPaid !== undefined ? isPaid : undefined, order: order ?? 0 },
    });
    res.json(card);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/budget/credit-cards/:id', async (req, res) => {
  try {
    await prisma.creditCard.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Clear Entry.money for a given month (default: current month)
app.delete('/api/budget/spending', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const { month } = req.query; // e.g. "2026-08"
    const prefix = month || new Date().toISOString().slice(0, 7);
    await prisma.entry.updateMany({
      where: { userId: user.id, date: { startsWith: prefix } },
      data: { money: null },
    });
    res.json({ ok: true });
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


// ── Notification Reminders ────────────────────────────────────────────────────

const defaultNotificationRules = [
  { name: 'Night Shutdown', time: '23:30', message: "It's time for Night Shutdown... complete your 10 mins reset" },
];

app.get('/api/notifications', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    let rules = await prisma.notificationRule.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    if (rules.length === 0) {
      await prisma.notificationRule.createMany({
        data: defaultNotificationRules.map((r) => ({ ...r, userId: user.id })),
      });
      rules = await prisma.notificationRule.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    }
    res.json(rules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const { id, name, message, time, isActive, daysOfWeek } = req.body;
    const days = Array.isArray(daysOfWeek) ? daysOfWeek.join(',') : (daysOfWeek || '0,1,2,3,4,5,6');
    const rule = await prisma.notificationRule.upsert({
      where: { id: id || 'new' },
      create: { userId: user.id, name, message, time, isActive: isActive ?? true, daysOfWeek: days },
      update: { name, message, time, isActive: isActive ?? true, daysOfWeek: days },
    });
    res.json(rule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    await prisma.notificationRule.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/:id/test', async (req, res) => {
  try {
    const rule = await prisma.notificationRule.findUnique({ where: { id: req.params.id } });
    if (!rule) return res.status(404).json({ error: 'Not found' });
    await sendTelegramMessage(rule.message);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Google Fit Integration ────────────────────────────────────────────────────

app.get('/api/integrations/google-fit/auth', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Google credentials not configured' });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.location.read');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  res.redirect(url.toString());
});

app.get('/api/integrations/google-fit/callback', async (req, res) => {
  const frontendUrl = FRONTEND_URL || 'http://localhost:5173';
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${frontendUrl}?gfit=error`);
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI, grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) return res.redirect(`${frontendUrl}?gfit=error`);
    await prisma.googleFitToken.upsert({
      where: { userId: DEFAULT_USER_ID },
      create: {
        userId: DEFAULT_USER_ID,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
      },
      update: {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
      },
    });
    res.redirect(`${frontendUrl}?gfit=connected`);
  } catch (err) {
    console.error('Google Fit callback error:', err);
    res.redirect(`${frontendUrl}?gfit=error`);
  }
});

app.get('/api/integrations/google-fit/status', requireAuth, async (req, res) => {
  try {
    const gToken = await prisma.googleFitToken.findUnique({ where: { userId: req.userId } });
    res.json({ connected: !!gToken, updatedAt: gToken?.updatedAt || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/integrations/google-fit', requireAuth, async (req, res) => {
  try {
    await prisma.googleFitToken.deleteMany({ where: { userId: req.userId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/integrations/google-fit/debug', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    let gToken = await prisma.googleFitToken.findUnique({ where: { userId: DEFAULT_USER_ID } });
    if (!gToken) return res.status(400).json({ error: 'Not connected' });
    if (new Date() >= gToken.expiresAt) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ refresh_token: gToken.refreshToken, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token' }),
      });
      const refreshed = await refreshRes.json();
      gToken = await prisma.googleFitToken.update({ where: { userId: DEFAULT_USER_ID }, data: { accessToken: refreshed.access_token, expiresAt: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000) } });
    }
    const endMs = Date.now();
    const startMs = endMs - days * 24 * 60 * 60 * 1000;
    const fitRes = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${gToken.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }, { dataTypeName: 'com.google.distance.delta' }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    });
    const raw = await fitRes.json();
    res.json(raw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/integrations/google-fit/sync', requireAuth, async (req, res) => {
  try {
    const { days = 7 } = req.body;
    const user = await getOrCreateUser(req.userId);
    let gToken = await prisma.googleFitToken.findUnique({ where: { userId: req.userId } });
    if (!gToken) return res.status(400).json({ error: 'Not connected to Google Fit' });

    // Refresh token if expired
    if (new Date() >= gToken.expiresAt) {
      if (!gToken.refreshToken) return res.status(400).json({ error: 'Token expired. Please reconnect Google Fit.' });
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: gToken.refreshToken, client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token',
        }),
      });
      const refreshed = await refreshRes.json();
      if (!refreshed.access_token) return res.status(400).json({ error: 'Failed to refresh token. Please reconnect.' });
      gToken = await prisma.googleFitToken.update({
        where: { userId: req.userId },
        data: { accessToken: refreshed.access_token, expiresAt: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000) },
      });
    }

    // Fetch steps and distance separately so a missing scope on one doesn't break the other
    const endMs = Date.now();
    const startMs = endMs - days * 24 * 60 * 60 * 1000;
    const authHeader = { Authorization: `Bearer ${gToken.accessToken}`, 'Content-Type': 'application/json' };
    const body = (types) => JSON.stringify({ aggregateBy: types.map((t) => ({ dataTypeName: t })), bucketByTime: { durationMillis: 86400000 }, startTimeMillis: startMs, endTimeMillis: endMs });

    const [stepsRes, distRes] = await Promise.all([
      fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', { method: 'POST', headers: authHeader, body: body(['com.google.step_count.delta']) }),
      fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', { method: 'POST', headers: authHeader, body: body(['com.google.distance.delta']) }),
    ]);

    const stepsData = await stepsRes.json();
    const distData = distRes.ok ? await distRes.json() : { bucket: [] };

    if (!distRes.ok) console.warn('[GFit] distance fetch failed (scope missing?):', await distRes.text().catch(() => ''));

    // Build per-date maps
    const stepsMap = {}, distMap = {};
    for (const bucket of stepsData.bucket || []) {
      const d = new Date(parseInt(bucket.startTimeMillis));
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      let s = 0;
      for (const dataset of bucket.dataset || []) for (const pt of dataset.point || []) for (const v of pt.value || []) s += (v.intVal || 0);
      stepsMap[ds] = s; // store 0 too so we can log it
    }
    for (const bucket of distData.bucket || []) {
      const d = new Date(parseInt(bucket.startTimeMillis));
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      let m = 0;
      for (const dataset of bucket.dataset || []) for (const pt of dataset.point || []) for (const v of pt.value || []) m += (v.fpVal || 0);
      distMap[ds] = parseFloat((m / 1000).toFixed(2));
    }

    // Overwrite ALL historical data — always write whatever Google Fit says
    const allDates = new Set([...Object.keys(stepsMap), ...Object.keys(distMap)]);
    let synced = 0;
    for (const dateStr of allDates) {
      const steps = stepsMap[dateStr] > 0 ? stepsMap[dateStr] : null;
      const distanceKm = distMap[dateStr] > 0 ? distMap[dateStr] : null;
      await prisma.entry.upsert({
        where: { userId_date: { userId: user.id, date: dateStr } },
        create: { userId: user.id, date: dateStr, steps, runWalk: distanceKm },
        update: { steps, runWalk: distanceKm }, // always overwrite, even with null
      });
      if (steps || distanceKm) synced++;
    }
    res.json({ ok: true, synced, days, stepsdays: Object.keys(stepsMap).filter(d => stepsMap[d] > 0).length, distdays: Object.keys(distMap).filter(d => distMap[d] > 0).length });
  } catch (err) {
    console.error('Google Fit sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startReminderScheduler(prisma);
});
