const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

function toDateStr(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function addToHeatmap(heatmap, dateStr) {
  heatmap.set(dateStr, (heatmap.get(dateStr) || 0) + 1);
}

async function fetchCodeforcesStats(handle) {
  const res = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`);
  const data = await res.json();
  if (data.status !== 'OK') throw new Error(data.comment || 'Codeforces request failed');

  const solved = new Set();
  const heatmap = new Map();
  let lastSolvedSeconds = null;

  for (const sub of data.result) {
    if (sub.verdict !== 'OK') continue;
    const key = `${sub.problem.contestId}${sub.problem.index}`;
    solved.add(key);
    addToHeatmap(heatmap, toDateStr(sub.creationTimeSeconds));
    if (!lastSolvedSeconds || sub.creationTimeSeconds > lastSolvedSeconds) {
      lastSolvedSeconds = sub.creationTimeSeconds;
    }
  }

  return {
    solvedCount: solved.size,
    lastSolvedDate: lastSolvedSeconds ? toDateStr(lastSolvedSeconds) : null,
    heatmap,
    solvedSet: solved, // Set of "{contestId}{index}" — used to live-check upsolve bucket status
  };
}

async function fetchLeetCodeStats(username) {
  const query = `query userProfile($username: String!) {
    matchedUser(username: $username) {
      submitStatsGlobal { acSubmissionNum { difficulty count } }
      userCalendar { submissionCalendar }
    }
    recentAcSubmissionList(username: $username, limit: 1) { timestamp }
  }`;
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ query, variables: { username } }),
  });
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors[0].message);
  if (!data?.matchedUser) throw new Error('LeetCode user not found');

  const all = data.matchedUser.submitStatsGlobal.acSubmissionNum.find((s) => s.difficulty === 'All');
  const solvedCount = all ? all.count : 0;

  const lastAc = data.recentAcSubmissionList?.[0];
  const lastSolvedDate = lastAc ? toDateStr(Number(lastAc.timestamp)) : null;

  const heatmap = new Map();
  const calendarRaw = data.matchedUser.userCalendar?.submissionCalendar;
  if (calendarRaw) {
    const calendar = JSON.parse(calendarRaw);
    for (const [unixDay, count] of Object.entries(calendar)) {
      heatmap.set(toDateStr(Number(unixDay)), Number(count));
    }
  }

  return { solvedCount, lastSolvedDate, heatmap };
}

async function fetchAtCoderStats(username) {
  const [rankRes, subsRes] = await Promise.all([
    fetch(`https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=${encodeURIComponent(username)}`),
    fetch(`https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(username)}&from_second=0`),
  ]);
  const rankData = await rankRes.json();
  if (!rankData || typeof rankData.count !== 'number') throw new Error('AtCoder user not found');

  const submissions = await subsRes.json();
  const heatmap = new Map();
  let lastSolvedSeconds = null;
  for (const sub of submissions) {
    if (sub.result !== 'AC') continue;
    addToHeatmap(heatmap, toDateStr(sub.epoch_second));
    if (!lastSolvedSeconds || sub.epoch_second > lastSolvedSeconds) lastSolvedSeconds = sub.epoch_second;
  }

  return {
    solvedCount: rankData.count,
    lastSolvedDate: lastSolvedSeconds ? toDateStr(lastSolvedSeconds) : null,
    heatmap,
  };
}

let problemsetCache = null; // Map<"{contestId}{index}", name>, refreshed at most once per TTL
let problemsetFetchedAt = 0;

export async function getCodeforcesProblemName(contestId, index) {
  if (!problemsetCache || Date.now() - problemsetFetchedAt > CACHE_TTL_MS) {
    const res = await fetch('https://codeforces.com/api/problemset.problems');
    const data = await res.json();
    if (data.status !== 'OK') throw new Error(data.comment || 'Codeforces problemset request failed');
    problemsetCache = new Map(data.result.problems.map((p) => [`${p.contestId}${p.index}`, p.name]));
    problemsetFetchedAt = Date.now();
  }
  return problemsetCache.get(`${contestId}${index}`) || null;
}

const FETCHERS = {
  codeforces: fetchCodeforcesStats,
  leetcode: fetchLeetCodeStats,
  atcoder: fetchAtCoderStats,
};

export async function getPlatformStats(platform, username, force = false) {
  const cacheKey = `${platform}:${username}`;
  const cached = cache.get(cacheKey);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const fetcher = FETCHERS[platform];
  if (!fetcher) throw new Error(`Unknown platform: ${platform}`);

  try {
    const data = await fetcher(username);
    cache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    const errorResult = { error: err.message };
    cache.set(cacheKey, { data: errorResult, fetchedAt: Date.now() });
    return errorResult;
  }
}
