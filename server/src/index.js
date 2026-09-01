import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { defaultHabits, defaultCategories } from '../../shared/constants.js';
import { startReminderScheduler, deliverReminder } from './scheduler.js';
import { getVapidPublicKey, sendWebPush } from './webpush.js';
import { getPlatformStats, getCodeforcesProblemName } from './cpStats.js';
import { syncGoogleFit } from './googleFitSync.js';
import { startGoogleFitScheduler } from './googleFitScheduler.js';
import { startBudgetResetScheduler, captureSnapshot } from './budgetScheduler.js';
import { startCpAutoCheckScheduler } from './cpAutoCheckScheduler.js';

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

const defaultLearningTopics = {
  cp: [
    'Arrays & Prefix Sums (diff arrays, Kadane, coord. compression)',
    'Sorting & Binary Search (incl. on answer, ternary)',
    'Strings & Hashing (KMP, Z-function, rolling hash)',
    'Trie',
    'Two Pointers & Sliding Window',
    'Linked List',
    'Stack & Queue (monotonic stack/queue, deque)',
    'Heap / Priority Queue (top K, two heaps, k-way merge)',
    'Union-Find (DSU)',
    'Fenwick Tree / BIT',
    'Segment Tree (incl. lazy propagation)',
    'Trees — Core (DFS/BFS, diameter, Euler tour, binary lifting, LCA, rerooting)',
    'Trees — Advanced (HLD, centroid decomposition)',
    'Graphs — Fundamentals (components, cycles, bipartite, topo sort)',
    'Shortest Paths (Dijkstra, 0-1 BFS, Bellman-Ford, Floyd-Warshall)',
    'MST (Kruskal, Prim)',
    'Advanced Graphs (SCC, bridges, articulation points, DAG DP)',
    'Max Flow / Min Cut / Matching',
    'DP — Basics (1D/2D, knapsack, LIS, LCS, grid DP)',
    'DP — Intermediate (interval, bitmask, tree, digit DP)',
    'DP — Advanced (D&C DP, CHT, SOS DP, optimizations)',
    'Number Theory (GCD, modular arithmetic, sieve, CRT)',
    'Combinatorics & Probability (nCr, inclusion-exclusion, game theory)',
    'Backtracking',
  ],
  dev: [
    'Core Java & OOP (SOLID, composition vs inheritance)',
    'Java Language Features (generics, streams, Optional, records)',
    'Java Collections (HashMap, TreeMap, PriorityQueue, ConcurrentHashMap)',
    'HashMap Internals (hashCode, buckets, collisions)',
    'Java Concurrency (ExecutorService, Future, CompletableFuture, locks)',
    'Concurrency Concepts (race conditions, deadlocks, happens-before)',
    'JVM & Memory (heap, GC, young/old gen, OOM)',
    'Spring Core (IoC, DI, beans, bean lifecycle, profiles)',
    'Spring Boot (controllers, services, DTOs, validation, actuator)',
    'Spring Data JPA (relationships, lazy loading, N+1, transactions)',
    'REST API Design (status codes, idempotency, pagination, versioning)',
    'API Security (JWT, OAuth2, RBAC, CORS/CSRF)',
    'SQL Mastery (joins, CTEs, window functions)',
    'Database Internals (indexes, B-tree, ACID, isolation, MVCC)',
    'Redis (data types, cache-aside/write-through, TTL, distributed locks)',
    'Kafka (partitions, consumer groups, delivery semantics, DLQ)',
    'Microservices Architecture (boundaries, gateway, service discovery)',
    'Microservices Reliability (retry, backoff, circuit breaker, tracing)',
    'Docker (Dockerfile, layers, volumes, compose, multi-stage builds)',
    'Kubernetes (pod, deployment, service, ingress, HPA, probes)',
    'AWS Core (EC2, S3, RDS, IAM, VPC, ALB, SQS/SNS, ECS/EKS/Lambda)',
    'Operating Systems (process/thread, scheduling, deadlock, virtual memory)',
    'Networking (TCP/UDP, HTTP/HTTPS, DNS, TLS, WebSockets)',
  ],
  system_design: [
    'Scaling (vertical/horizontal, stateless services, load balancing)',
    'Caching Strategies (CDN, cache-aside, write-through, write-behind)',
    'Database Scaling (replication, partitioning, sharding, SQL vs NoSQL)',
    'Messaging Systems (Kafka, RabbitMQ, SQS)',
    'CAP Theorem & Consistency (strong vs eventual, leader/follower)',
    'Distributed Coordination (distributed locks, consensus concepts)',
    'Reliability Patterns (idempotency, retry, timeout, backpressure)',
    'HLD: URL Shortener',
    'HLD: Rate Limiter',
    'HLD: Notification System',
    'HLD: Pastebin',
    'HLD: WhatsApp / Chat System',
    'HLD: Uber / Ride Sharing',
    'HLD: Instagram',
    'HLD: YouTube',
    'HLD: Twitter',
    'HLD: Ticket Booking',
    'HLD: Food Delivery',
    'HLD: Payment System',
    'HLD: Distributed Cache',
    'HLD: Search Engine',
    'HLD: Distributed Job Scheduler',
    'HLD: Distributed Messaging System',
    'LLD Principles & Patterns (SOLID, Factory, Builder, Strategy, Observer)',
    'LLD: Parking Lot',
    'LLD: Elevator',
    'LLD: Vending Machine',
    'LLD: ATM',
    'LLD: Splitwise',
    'LLD: Logger',
    'LLD: Chess',
    'LLD: Car Rental / Ride Sharing',
  ],
  ai_engineering: [
    'Prompt Engineering', 'Embeddings & Vector DBs', 'RAG Pipelines',
    'Fine-tuning vs Few-shot', 'LLM Evaluation', 'Agents & Tool Use',
    'Transformer Basics', 'Model Serving / Inference', 'AI Safety', 'MLOps Basics',
  ],
};


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
        xpValue: h.xpValue ?? 5,
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

// Draws `delta` (positive = spend, negative = refund) from the user's Bank or Cash balance,
// whichever `source` says. Keeps "Money I Have" in sync with logged spend instead of it being
// a pure manual snapshot. Returns both balances so callers can hand back whichever changed.
async function adjustBalance(userId, source, delta) {
  if (!delta) return undefined;
  const bs = await prisma.budgetSetting.findUnique({ where: { userId } });
  if (!bs) return undefined;
  const field = source === 'cash' ? 'cashBalance' : 'bankBalance';
  const updated = await prisma.budgetSetting.update({
    where: { userId },
    data: { [field]: (bs[field] || 0) - delta },
  });
  return { bankBalance: updated.bankBalance, cashBalance: updated.cashBalance };
}

// Applies two potential adjustments (e.g. refund old source, draw new source) and merges
// their resulting balances so a source switch only needs one response payload.
function mergeBalances(...results) {
  return results.reduce((acc, r) => (r ? { ...acc, ...r } : acc), undefined);
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
      where: { userId: user.id, deletedAt: null },
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

    const existingEntry = await prisma.entry.findUnique({ where: { userId_date: { userId: user.id, date } } });
    const previousDeducted = existingEntry?.moneyDeducted || 0;
    const previousSource = existingEntry?.moneySource || 'bank';
    const newMoney = entryData.money || 0;
    const newSource = payload.moneySource || previousSource;
    entryData.moneySource = newSource;

    const entry = await prisma.entry.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: { userId: user.id, date, ...entryData, moneyDeducted: newMoney },
      update: { ...entryData, moneyDeducted: newMoney, deletedAt: null },
    });

    // A source switch (e.g. Bank -> Cash) refunds the old source in full and draws the
    // new source in full, instead of taking a same-source delta.
    let balances;
    if (previousSource === newSource) {
      const delta = newMoney - previousDeducted;
      if (delta) balances = await adjustBalance(user.id, newSource, delta);
    } else {
      const refund = previousDeducted ? await adjustBalance(user.id, previousSource, -previousDeducted) : undefined;
      const draw = newMoney ? await adjustBalance(user.id, newSource, newMoney) : undefined;
      balances = mergeBalances(refund, draw);
    }

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
    res.json({ ...updated, bankBalance: balances?.bankBalance, cashBalance: balances?.cashBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/entries/:id', async (req, res) => {
  try {
    const entry = await prisma.entry.findUnique({ where: { id: req.params.id } });
    const balances = entry?.moneyDeducted ? await adjustBalance(entry.userId, entry.moneySource || 'bank', -entry.moneyDeducted) : undefined;
    // Soft delete — never destroy journal data. Hidden from the app, but recoverable
    // (clear deletedAt directly in the DB) if a deletion was accidental. moneyDeducted is
    // zeroed since it's already been refunded above, so bulk operations (Clear this month)
    // can't double-refund it later.
    await prisma.entry.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), moneyDeducted: 0 } });
    res.json({ ok: true, bankBalance: balances?.bankBalance, cashBalance: balances?.cashBalance });
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
    const { id, name, type, budgetedAmount, spentAmount, order, paymentSource } = req.body;
    const resolvedType = type || 'daily';

    const existing = id ? await prisma.budgetCategory.findUnique({ where: { id } }) : null;
    const resolvedSource = paymentSource || existing?.paymentSource || 'bank';

    const category = await prisma.budgetCategory.upsert({
      where: { id: id || 'new' },
      create: { budgetSettingId: budgetSetting.id, name, type: resolvedType, budgetedAmount: budgetedAmount || 0, spentAmount: spentAmount || 0, paymentSource: resolvedSource, order: order ?? 0 },
      update: { name, type: resolvedType, budgetedAmount: budgetedAmount || 0, spentAmount: spentAmount !== undefined ? spentAmount : undefined, paymentSource: resolvedSource, order: order ?? 0 },
    });

    // Fixed categories' spentAmount is a direct "have I paid this" tracker (unlike daily
    // categories, whose spend is derived from Entry.money and already synced there) — draw
    // the delta from whichever balance (Bank/Cash) is configured for this category. A
    // source switch refunds the old one in full and draws the new one in full.
    let balances;
    if (resolvedType === 'fixed' && spentAmount !== undefined) {
      const previousSpent = existing?.spentAmount || 0;
      const previousSource = existing?.paymentSource || 'bank';
      if (previousSource === resolvedSource) {
        const delta = spentAmount - previousSpent;
        if (delta) balances = await adjustBalance(user.id, resolvedSource, delta);
      } else {
        const refund = previousSpent ? await adjustBalance(user.id, previousSource, -previousSpent) : undefined;
        const draw = spentAmount ? await adjustBalance(user.id, resolvedSource, spentAmount) : undefined;
        balances = mergeBalances(refund, draw);
      }
    }

    res.json({ ...category, bankBalance: balances?.bankBalance, cashBalance: balances?.cashBalance });
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
    const { id, name, currentBalance, creditLimit, rewardPoints, dueDate, isPaid, order } = req.body;
    const balance = isPaid ? 0 : (currentBalance || 0);

    const existing = id ? await prisma.creditCard.findUnique({ where: { id } }) : null;

    const card = await prisma.creditCard.upsert({
      where: { id: id || 'new' },
      create: { budgetSettingId: budgetSetting.id, name, currentBalance: balance, creditLimit: creditLimit || null, rewardPoints: rewardPoints ?? null, dueDate: dueDate ? new Date(dueDate) : null, isPaid: isPaid || false, order: order ?? 0 },
      update: { name, currentBalance: balance, creditLimit: creditLimit || null, rewardPoints: rewardPoints ?? null, dueDate: dueDate ? new Date(dueDate) : null, isPaid: isPaid !== undefined ? isPaid : undefined, order: order ?? 0 },
    });

    // A drop in outstanding balance means the card was actually paid down — that money
    // really left Bank. A rise (a new charge) is just recorded debt, not a bank transaction,
    // so only decreases draw from Bank (and can take it negative, same as any real payment).
    let balances;
    if (existing) {
      const paidDown = (existing.currentBalance || 0) - balance;
      if (paidDown > 0) balances = await adjustBalance(user.id, 'bank', paidDown);
    }

    res.json({ ...card, bankBalance: balances?.bankBalance });
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

    const affected = await prisma.entry.findMany({
      where: { userId: user.id, date: { startsWith: prefix }, deletedAt: null },
      select: { moneyDeducted: true, moneySource: true },
    });
    const refundBySource = affected.reduce((acc, e) => {
      const source = e.moneySource || 'bank';
      acc[source] = (acc[source] || 0) + (e.moneyDeducted || 0);
      return acc;
    }, {});
    for (const [source, amount] of Object.entries(refundBySource)) {
      if (amount) await adjustBalance(user.id, source, -amount);
    }

    await prisma.entry.updateMany({
      where: { userId: user.id, date: { startsWith: prefix }, deletedAt: null },
      data: { money: null, moneyDeducted: 0 },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/budget/snapshots', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const snapshots = await prisma.budgetSnapshot.findMany({
      where: { userId: user.id },
      orderBy: { month: 'desc' },
    });
    res.json(snapshots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/budget/snapshots/capture', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const { month } = req.body; // e.g. "2026-08"; defaults to current month
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    let budgetSetting = await prisma.budgetSetting.findUnique({ where: { userId: user.id } });
    if (!budgetSetting) return res.status(400).json({ error: 'No budget settings found' });
    await captureSnapshot(prisma, budgetSetting, targetMonth);
    const snapshot = await prisma.budgetSnapshot.findUnique({ where: { userId_month: { userId: user.id, month: targetMonth } } });
    res.json(snapshot);
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

    const result = await deliverReminder(prisma, rule);
    res.json({
      ok: result.pushSent > 0 || result.telegramOk === true,
      push: { sent: result.pushSent, total: result.pushTotal },
      telegram: result.telegramAttempted
        ? { attempted: true, ok: result.telegramOk, error: result.telegramError }
        : { attempted: false },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Web Push (browser/PWA notifications) ──────────────────────────────────────

app.get('/api/push/public-key', (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

app.post('/api/push/subscribe', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Invalid subscription' });
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { p256dh: keys.p256dh, auth: keys.auth },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/push/subscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/push/test', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const subs = await prisma.pushSubscription.findMany({ where: { userId: user.id } });
    if (subs.length === 0) return res.status(400).json({ error: 'No browser subscriptions found' });
    let sent = 0;
    for (const sub of subs) {
      try {
        await sendWebPush(sub, { title: 'GSD Test', body: 'Push notifications are working 🎉' });
        sent++;
      } catch (err) {
        if (err.gone) await prisma.pushSubscription.delete({ where: { id: sub.id } });
        else console.error('[push] test send failed:', err.message);
      }
    }
    res.json({ ok: true, sent, total: subs.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Learning ───────────────────────────────────────────────────────────────────

app.get('/api/learning/topics', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const category = req.query.category;
    if (!category || !defaultLearningTopics[category]) return res.status(400).json({ error: 'Invalid category' });

    let topics = await prisma.learningTopic.findMany({
      where: { userId: user.id, category },
      orderBy: { order: 'asc' },
    });
    if (topics.length === 0) {
      await prisma.learningTopic.createMany({
        data: defaultLearningTopics[category].map((name, i) => ({ userId: user.id, category, name, order: i })),
      });
      topics = await prisma.learningTopic.findMany({ where: { userId: user.id, category }, orderBy: { order: 'asc' } });
    }
    res.json(topics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/learning/topics', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const { id, category, name, status, order } = req.body;
    const topic = await prisma.learningTopic.upsert({
      where: { id: id || 'new' },
      create: { userId: user.id, category, name, status: status || 'todo', order: order ?? 0 },
      update: { name, status: status || 'todo', order: order ?? 0 },
    });
    res.json(topic);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/learning/topics/:id', async (req, res) => {
  try {
    await prisma.learningTopic.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/learning/cp-profiles', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const profiles = await prisma.codingProfile.findMany({ where: { userId: user.id } });
    res.json(profiles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/learning/cp-profiles', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const { platform, username } = req.body;
    if (!['codeforces', 'leetcode', 'atcoder'].includes(platform)) return res.status(400).json({ error: 'Invalid platform' });
    const profile = await prisma.codingProfile.upsert({
      where: { userId_platform: { userId: user.id, platform } },
      create: { userId: user.id, platform, username },
      update: { username },
    });
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/learning/cp-profiles/:platform', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    await prisma.codingProfile.deleteMany({ where: { userId: user.id, platform: req.params.platform } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/learning/cp-stats', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const force = req.query.force === 'true';
    const profiles = await prisma.codingProfile.findMany({ where: { userId: user.id } });

    const combinedHeatmap = new Map();
    const platforms = await Promise.all(
      profiles.map(async (profile) => {
        const stats = await getPlatformStats(profile.platform, profile.username, force);
        if (!stats.error) {
          for (const [date, count] of stats.heatmap) {
            combinedHeatmap.set(date, (combinedHeatmap.get(date) || 0) + count);
          }
        }
        return {
          platform: profile.platform,
          username: profile.username,
          solvedCount: stats.solvedCount ?? null,
          lastSolvedDate: stats.lastSolvedDate ?? null,
          error: stats.error || null,
        };
      })
    );

    res.json({
      platforms,
      heatmap: Array.from(combinedHeatmap.entries()).map(([date, count]) => ({ date, count })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── Upsolve Bucket (Codeforces only) ──────────────────────────────────────────

// Handles /problemset/problem/{id}/{index}, /contest/{id}/problem/{index}, and
// /gym/{id}/problem/{index}. Gym problems aren't in problemset.problems, so their name
// can't be auto-looked-up — that's fine, the user can fill it in manually.
function parseCodeforcesUrl(url) {
  for (const pattern of [
    /codeforces\.com\/contest\/(\d+)\/problem\/(\w+)/i,
    /codeforces\.com\/problemset\/problem\/(\d+)\/(\w+)/i,
    /codeforces\.com\/gym\/(\d+)\/problem\/(\w+)/i,
  ]) {
    const m = url.match(pattern);
    if (m) return { contestId: parseInt(m[1], 10), index: m[2].toUpperCase() };
  }
  return null;
}

app.get('/api/learning/upsolve', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const problems = await prisma.upsolveProblem.findMany({ where: { userId: user.id }, orderBy: { order: 'asc' } });

    const cfProfile = await prisma.codingProfile.findUnique({ where: { userId_platform: { userId: user.id, platform: 'codeforces' } } });
    let solvedSet = new Set();
    if (cfProfile) {
      const stats = await getPlatformStats('codeforces', cfProfile.username);
      if (!stats.error) solvedSet = stats.solvedSet;
    }

    const withStatus = problems.map((p) => ({
      ...p,
      solved: p.contestId && p.problemIndex ? solvedSet.has(`${p.contestId}${p.problemIndex}`) : false,
    }));
    res.json(withStatus);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/learning/upsolve', async (req, res) => {
  try {
    const user = await getOrCreateUser(req.userId);
    const { id, url, name, notes, order } = req.body;

    const existing = id ? await prisma.upsolveProblem.findUnique({ where: { id } }) : null;
    const parsed = url ? parseCodeforcesUrl(url) : null;

    let resolvedName = name;
    if (resolvedName === undefined) {
      resolvedName = existing?.name ?? null;
      // Only auto-look-up the name on first save (new problem, or url just added) so a
      // manually-cleared name field doesn't get silently refilled on the next edit.
      if (parsed && !existing) {
        try {
          resolvedName = await getCodeforcesProblemName(parsed.contestId, parsed.index);
        } catch {
          resolvedName = null;
        }
      }
    }

    const problem = await prisma.upsolveProblem.upsert({
      where: { id: id || 'new' },
      create: {
        userId: user.id,
        platform: 'codeforces',
        url,
        contestId: parsed?.contestId ?? null,
        problemIndex: parsed?.index ?? null,
        name: resolvedName,
        notes: notes || null,
        order: order ?? 0,
      },
      update: {
        url: url ?? undefined,
        contestId: parsed ? parsed.contestId : undefined,
        problemIndex: parsed ? parsed.index : undefined,
        name: resolvedName,
        notes: notes !== undefined ? notes : undefined,
        order: order ?? undefined,
      },
    });
    res.json(problem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/learning/upsolve/:id', async (req, res) => {
  try {
    await prisma.upsolveProblem.delete({ where: { id: req.params.id } });
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
    await getOrCreateUser(req.userId);
    const result = await syncGoogleFit(prisma, req.userId, days);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Google Fit sync error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startReminderScheduler(prisma);
  startGoogleFitScheduler(prisma);
  startBudgetResetScheduler(prisma);
  startCpAutoCheckScheduler(prisma);
});
