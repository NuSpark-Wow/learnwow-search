// Learn...Wow! Search Engine
// Vercel serverless function. No packages needed.
//
// A visitor types a question. The search either asks one quick clarifying question,
// or gives a one-paragraph answer plus search-style listings that point to
// Learn...Wow! experiences and Mr. Paul's AI Library topic sections.
//
// Environment variables (Vercel > Project > Settings > Environment Variables):
//   ANTHROPIC_API_KEY        required
//   UPSTASH_REDIS_REST_URL   recommended (or KV_REST_API_URL)   — daily limits + answer cache
//   UPSTASH_REDIS_REST_TOKEN recommended (or KV_REST_API_TOKEN)
//   Optional: MODEL, VISITOR_DAILY (default 3), DAILY_GLOBAL (default 2000),
//             LIBRARY_URL, LW_GATE_URL, ALLOWED_HOSTS

const MODEL = process.env.MODEL || "claude-haiku-5-5";
const VISITOR_DAILY = parseInt(process.env.VISITOR_DAILY || "3", 10);
const DAILY_GLOBAL = parseInt(process.env.DAILY_GLOBAL || "2000", 10);
const LIBRARY_URL = (process.env.LIBRARY_URL || "https://mr-paul-ai-library.vercel.app").replace(/\/$/, "");
const GATE_URL = process.env.LW_GATE_URL || "https://mr-pauls-classroom.vercel.app/api/gate";
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS ||
  "nusparklearnwow.com,nusparkpublishing.com,nusparkmarketing.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const R_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const R_TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// ---------- The Learn...Wow! experiences (add a line here when a new one goes live) ----------
const SITE = "https://nusparklearnwow.com/";
const EXPERIENCES = [
  { id: "answer-man", name: "The Answer Man: Ask Mr. Paul", path: "the-answer-man-mr-paul/",
    about: "Full, in-depth answers through 8 doors (Who, What, Where, When, Why, How, Evolution, Future), plus Ranking Research lists of 25, 50 or 100 in A–Z order." },
  { id: "classroom", name: "Mr. Paul's Classroom", path: "mr-pauls-classroom/",
    about: "An AI teacher for kids: Mr. Paul teaches any school topic on a smart board, at the child's grade level." },
  { id: "lecture-hall", name: "The Lecture Hall", path: "the-lecture-hall/",
    about: "Guided, college-style lectures for adults on any subject." },
  { id: "how-it-works", name: "How It Works", path: "how-it-works/",
    about: "Explains how everyday things, machines and systems work, step by step." },
  { id: "secrets", name: "The Secrets of the World", path: "the-secrets-of-the-world/",
    about: "Source-checked, little-known secrets and surprising facts about the world, for the whole family." },
  { id: "remember-when", name: "Remember When", path: "remember-when/",
    about: "A trip back through the decades: the music, TV, products, fads and events people remember." },
  { id: "food-hall", name: "The Food Hall", path: "the-food-hall/",
    about: "Food education: where foods come from, their history, the science of cooking, and food around the world. Not a cookbook." },
  { id: "boardroom", name: "The Boardroom", path: "the-boardroom-for-business/",
    about: "MBA-style business learning: how companies, markets, money, marketing and management work, for big companies and small businesses." },
  { id: "encyclopedias", name: "The AI Encyclopedias", path: "the-ai-encyclopedias/",
    about: "The home of Mr. Paul's AI Library: hundreds of guided learning tools across 16 topics." },
  { id: "debate-me", name: "Debate Me", path: "debate-me/",
    about: "Debate an on-screen AI host on a topic, with researched proof charts for each side." },
  { id: "difference", name: "What's the Difference?", path: "whats-the-difference/",
    about: "Compares two things side by side and explains exactly how they differ." },
  { id: "science-lab", name: "The Science Lab", path: "the-science-lab/",
    about: "Hands-on science: experiments and explanations with Mr. Paul." },
  { id: "travel-agent", name: "The Travel Agent", path: "the-travel-agent/",
    about: "Explore destinations around the world: places, culture, history and what to know before you go." },
  { id: "news-desk", name: "The Catch-Up News Desk", path: "the-catch-up-news-desk/",
    about: "Catch up on the news you missed, by time window and location." },
  { id: "art-studio", name: "The Art Studio", path: "the-art-studio/",
    about: "Art lessons in famous styles plus an online paint canvas." },
  { id: "music-studio", name: "The Music Studio", path: "the-music-studio/",
    about: "Make your own music: write on a staff, pick instruments, and learn how music is built." },
  { id: "sports-arena", name: "The All-Time Sports Arena", path: "the-all-time-sports-arena/",
    about: "Simulated baseball and football matchups between great teams and players from different eras." },
  { id: "board-games", name: "Board Game Time", path: "board-game-time/",
    about: "Play classic board games against computer players." },
  { id: "card-table", name: "The Card Table", path: "the-card-table/",
    about: "Play classic card games with an AI card partner." },
  { id: "puzzle-parlor", name: "The Puzzle Parlor", path: "the-puzzle-parlor/",
    about: "Puzzles and brain challenges of many kinds." },
  { id: "guess-room", name: "The Guess Room", path: "the-guess-room/",
    about: "Guessing games and mysteries, including a detective mode." },
  { id: "corner-cafe", name: "The Corner Café", path: "the-corner-cafe/",
    about: "Friendly one-on-one or roundtable chats with AI personalities, for adults 18 and up." },
  { id: "decision-room", name: "The Decision Room", path: "the-decision-room/",
    about: "What would you do? Real-life scenarios in 12 categories (sports, business, money, science, history, law, ethics, daily life, parenting, kids and more) or your own topic; pick an outcome, hear from AI advisors, then see what could go right and wrong." },
  { id: "word-grammar", name: "Word & Grammar Guide", path: "word-grammar-guide/",
    about: "Three word tools in one: The Word Shop (meanings, word origins, idioms, slang through the decades, today's slang decoded), Grammar Games (who or whom, rule or myth, punctuation, polish your own writing) and Wordplay Central (double meanings, misheard phrases, brain-trap sentences, twist endings)." },
  { id: "buyers-guide", name: "The Buyer's Guide", path: "the-buyers-guide/",
    about: "An unbiased guide to buying or hiring anything for home or business: what to look for, real costs, red flags and questions to ask, plus an advisor panel and Mr. Paul's verdict. Never recommends brands." },
  { id: "health-club", name: "The Health Club", path: "the-health-club/",
    about: "Health and fitness learning: exercise lessons, home workouts, nutrition basics, healthy habits and myth-checking, with AI coaches and printables. Education, not medical advice." },
  { id: "fix-it", name: "Fix It. Clean It. Maintain It.", path: "fix-it-clean-it-maintain-it/",
    about: "How to fix, clean and maintain things around the home, with AI helpers, diagrams, safety checks and difficulty ratings." },
  { id: "marketing-guru", name: "The Marketing Guru", path: "the-marketing-guru/",
    about: "How marketing really works, explained by Paul Mosenson: 20 topics across tracking, advertising and media (TV, radio, social), leads and conversion, and sales and customers, for B2B or consumer businesses." },
];
const EXP_BY_ID = Object.fromEntries(EXPERIENCES.map((e) => [e.id, e]));

// ---------- Mr. Paul's AI Library (read live, so new library tools show up on their own) ----------
let LIB = null, LIB_AT = 0;
async function library() {
  if (LIB && Date.now() - LIB_AT < 6 * 3600 * 1000) return LIB;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(LIBRARY_URL + "/catalog.json", { signal: ctl.signal });
    clearTimeout(t);
    const c = await r.json();
    if (Array.isArray(c.topics) && Array.isArray(c.tools)) {
      const byTitle = {};
      c.tools.forEach((t) => { byTitle[norm(t.t)] = t; });
      LIB = { topics: c.topics, tools: c.tools, byTitle };
      LIB_AT = Date.now();
    }
  } catch { /* keep the last copy, or none */ }
  return LIB;
}

// ---------- rules ----------
function rules(lib, clarified) {
  const exp = EXPERIENCES.filter((e) => e.id !== "answer-man")
    .map((e) => `- ${e.id}: ${e.name} — ${e.about}`).join("\n");
  const libText = lib
    ? lib.topics.map((name, i) => `${name}: ` + lib.tools.filter((t) => t.k === i).map((t) => t.t).join(" | ")).join("\n")
    : "(library list unavailable — leave \"library\" empty)";
  return `You are the Learn...Wow! Search Engine on the NuSpark Learn...Wow! learning site. You give one clear, accurate paragraph that answers the question, then point the person to the Learn...Wow! experiences that go deeper. You speak as Learn...Wow!, never as a person.

RULES
1. Knowledge only. Never give maps, addresses, directions, phone numbers, hours, prices to buy, or "near me" results. Never use or ask for the person's location.
2. Companies: name a company only as fact or history. Never recommend, rank, compare, review or list companies, brands, products, apps, services or local businesses, and never point anyone to a business. For those questions use type "redirect": the answer must start with exactly "Learn...Wow! answers knowledge questions, so I don't recommend, rank, or point to specific companies or local businesses." and then give the knowledge version (what that kind of company does, how it works, what to look for in general).
3. Never rank opinion topics ("best", "top", "greatest", "favorite"). Say Learn...Wow! doesn't rank things like this because "best" depends on what you're looking for, give a short neutral overview, and mention that The Answer Man's Ranking Research builds A–Z lists of what shows up most in published rankings. Measurable facts (tallest, largest, oldest, fastest) get a straight answer.
4. Health, legal and money: general education only, and say to check with a doctor, lawyer or financial professional.
5. Be neutral on contested political, religious and social topics: explain the main views fairly, take no side.
6. Family-friendly always. For an inappropriate or unsafe question use type "redirect" with a kind reply and a better question to explore.
7. Accuracy first. If unsure, say so plainly. Use web search only when the answer depends on recent or current information. Never overgeneralize: say when something varies.
8. People type fast. Silently read past typos and answer what they meant. Never mention their mistakes.
9. Plain text only: no markdown, no lists, no headings, no links, no URLs.

CLARIFYING
${clarified
  ? "The person has already answered a clarifying question. Never ask another one: answer now."
  : `If, and only if, the question could mean truly different things (for example "Mercury": the planet, the element, the Roman god, or Freddie Mercury), or is a bare word or too vague to answer well, use type "clarify": write one short friendly question in "clarify" and 2 to 4 short tap options in "options". Clear questions are answered straight away. Never clarify just to narrow a small detail.`}

THE ANSWER
One paragraph of 60 to 110 words. Lead with the direct answer, then the most useful detail and one everyday example or interesting fact. Warm, smart, plain language.

LISTINGS — point to where to learn more
The Answer Man is always shown first automatically; do not include it.
"tools": pick 2 or 3 experiences from this list that genuinely fit the question, best fit first. For each write "line": one sentence (8 to 18 words) saying what the person can do there about THIS question. Only describe what that experience actually does, using its description below. Never invent features. Use an experience only if it truly fits; games and the Corner Café only for questions about games, play, puzzles or conversation.
${exp}

"library": pick 0 to 2 tools from Mr. Paul's AI Library that fit the question, copying their names EXACTLY as written below. Leave it empty if none truly fit.
${libText}

OUTPUT
Reply with ONLY one JSON object, nothing before or after it:
{"type": "answer" | "redirect" | "clarify", "question": "the question with spelling quietly fixed", "answer": "the paragraph (empty for clarify)", "clarify": "the clarifying question (only for clarify)", "options": ["..."], "tools": [{"id": "...", "line": "..."}], "library": ["exact tool name"]}`;
}

// ---------- helpers ----------
async function redis(cmd) {
  if (!R_URL || !R_TOK) return null;
  try {
    const r = await fetch(R_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${R_TOK}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    const j = await r.json();
    return j.result ?? null;
  } catch { return null; }
}
async function bump(key) {
  const n = await redis(["INCR", key]);
  if (n === 1) await redis(["EXPIRE", key, 90000]);
  return n;
}
function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
function today() { return new Date().toISOString().slice(0, 10); }
function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.headers["x-real-ip"] || "unknown";
}
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  let host;
  try { host = new URL(origin).hostname.toLowerCase(); } catch { return false; }
  const selfHost = String(req.headers.host || "").split(":")[0].toLowerCase();
  if (host === selfHost) return true;
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
}
function clean(s) {
  return String(s || "")
    .replace(/<[^>]{1,200}>/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\(?\s*(?:https?:\/\/|www\.)[^\s)<>\]]+\s*\)?/gi, " ")
    .replace(/\*\*|__|`+/g, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?)])/g, "$1")
    .trim();
}

// Is this person a LearnWow member? Asks the shared LearnWow Gate.
// Members: the gate counts the call against their monthly budget.
// Visitors: sent as a background call, so the search never uses up one of their site-wide tries.
async function whoIs(req, ip) {
  const hd = req.headers || {};
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
  try {
    const r = await fetch(GATE_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pass: hd["x-lw-pass"] || "", vid: hd["x-lw-vid"] || "", act: false, ip, tool: "search" }),
      signal: ctl.signal,
    });
    const j = await r.json();
    if (j && j.who === "member") return j.ok === false ? "member-budget" : "member";
    return "visitor";
  } catch { return "visitor"; } finally { clearTimeout(t); }
}

let LAST_STOP = "";
async function askClaude(system, user) {
  const messages = [{ role: "user", content: user }];
  let data;
  for (let turn = 0; turn < 3; turn++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }],
      }),
    });
    data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `API error ${r.status}`);
    if (data.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: data.content }); continue; }
    break;
  }
  LAST_STOP = data.stop_reason || "";
  const blocks = data.content || [];
  let last = -1;
  blocks.forEach((b, i) => { if (b.type === "web_search_tool_result") last = i; });
  return blocks.slice(last + 1).filter((b) => b.type === "text").map((b) => b.text).join("");
}

function buildResult(text, lib, original) {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  let j = {};
  if (s !== -1) {
    const raw = e > s ? text.slice(s, e + 1) : text.slice(s);
    try { j = JSON.parse(raw); }
    catch {
      try { j = JSON.parse(raw.replace(/[\u0000-\u001f]+/g, " ")); }
      catch {
        const grab = (k) => { const m = raw.match(new RegExp('"' + k + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"')); return m ? m[1].replace(/\\n/g, " ").replace(/\\"/g, '"') : ""; };
        j = { type: grab("type"), question: grab("question"), answer: grab("answer"), clarify: grab("clarify") };
        const ids = [...raw.matchAll(/"id"\s*:\s*"([a-z-]+)"\s*,\s*"line"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => ({ id: m[1], line: m[2] }));
        j.tools = ids;
      }
    }
  }
  const type = ["answer", "redirect", "clarify"].includes(j.type) ? j.type : "answer";
  const question = clean(j.question) || original;

  if (type === "clarify") {
    const options = (Array.isArray(j.options) ? j.options : []).map(clean).filter((x) => x && x.length < 80).slice(0, 4);
    if (clean(j.clarify) && options.length >= 2) return { type, question, clarify: clean(j.clarify), options };
  }

  const answer = clean(j.answer) || (s === -1 ? clean(text) : "");
  if (!answer) return null;

  const listings = [];
  const am = EXP_BY_ID["answer-man"];
  listings.push({ title: "The Answer Man: Ask Mr. Paul", url: SITE + am.path, crumb: "nusparklearnwow.com › the-answer-man",
    line: "Get the full answer, with history, how it works and what's next." });

  const seen = new Set(["answer-man"]);
  (Array.isArray(j.tools) ? j.tools : []).forEach((t) => {
    const x = EXP_BY_ID[t && t.id];
    if (!x || seen.has(x.id) || listings.length >= 4) return;
    seen.add(x.id);
    listings.push({ title: x.name, url: SITE + x.path, crumb: "nusparklearnwow.com › " + x.path.replace(/\/$/, ""),
      line: clean(t.line) || x.about });
  });

  if (lib) {
    const used = new Set();
    (Array.isArray(j.library) ? j.library : []).slice(0, 2).forEach((name) => {
      const t = lib.byTitle[norm(name)];
      if (!t || used.has(t.id)) return;
      used.add(t.id);
      const topic = lib.topics[t.k] || "Topics";
      listings.push({ title: t.t, url: `${SITE}the-ai-encyclopedias/#topic-${t.k}`, crumb: `Mr. Paul's AI Library › ${topic}`,
        line: t.d, library: true });
    });
  }
  return { type, question, answer, listings };
}

// ---------- handler ----------
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed", version: 6 });
  if (!originAllowed(req)) return res.status(403).json({ error: "Not allowed" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "The search isn't set up yet." });

  const body = req.body || {};
  const question = String(body.question || "").trim().slice(0, 300);
  const reply = String(body.reply || "").trim().slice(0, 120);       // answer to a clarifying question
  const asked = String(body.asked || "").trim().slice(0, 200);       // the clarifying question that was asked
  if (question.length < 2) return res.status(400).json({ error: "Please type a question." });
  const full = reply ? `${question} (clarified: ${asked ? asked + " — " : ""}${reply})` : question;

  const ip = clientIp(req);
  const day = today();

  // 1) Saved answers are instant and free, but still count toward a visitor's daily searches
  const cacheKey = `lws:v1:${norm(full)}`;
  const cachedText = await redis(["GET", cacheKey]);
  let cached = null;
  if (cachedText) { try { cached = JSON.parse(cachedText); } catch { cached = null; } }

  // 2) Member or visitor?
  const who = await whoIs(req, ip);
  if (who === "member-budget") {
    res.statusCode = 402;
    return res.json({ lwgate: "budget", error: "Monthly limit reached" });
  }
  const visitor = who !== "member";
  const vid = String(req.headers["x-lw-vid"] || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
  const ipKey = `lws:ip:${ip}:${day}`;
  const vidKey = vid ? `lws:v:${vid}:${day}` : null;

  if (visitor) {
    const [a, b] = await Promise.all([redis(["GET", ipKey]), vidKey ? redis(["GET", vidKey]) : null]);
    // shared networks (schools, offices) get a roomier limit per IP
    if (Number(b || 0) >= VISITOR_DAILY || Number(a || 0) >= VISITOR_DAILY * 4) {
      res.statusCode = 402;
      return res.json({ lwgate: "search", left: 0, error: "Daily searches used" });
    }
  }

  const countIt = async (result) => {
    if (!result || result.type === "clarify") return; // clarifying questions are free
    if (visitor) await Promise.all([bump(ipKey), vidKey ? bump(vidKey) : null]);
  };

  if (cached) { await countIt(cached); return res.status(200).json({ ...cached, cached: true }); }

  // 3) Site-wide daily safety cap
  if (Number(await redis(["GET", `lws:global:${day}`]) || 0) >= DAILY_GLOBAL) {
    return res.status(429).json({ error: "Learn...Wow! has answered a lot of questions today! Please come back tomorrow." });
  }

  try {
    const lib = await library();
    const sys = rules(lib, !!reply);
    const userMsg = reply
      ? `Question: ${question}\nWe asked: ${asked}\nThey answered: ${reply}\nAnswer now.`
      : `Question: ${question}`;
    // one automatic retry if the first try fails or comes back unreadable
    let text = "", result = null;
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try { text = await askClaude(sys, userMsg); result = buildResult(text, lib, question); }
      catch (err) { if (attempt === 1) throw err; }
    }
    if (!result) {
      console.error("search empty reply:", String(text).slice(0, 500));
      return res.status(502).json({ error: "The search had trouble with that one. Please try again.", detail: "empty (" + LAST_STOP + "): " + String(text).slice(-300) });
    }
    await bump(`lws:global:${day}`);
    if (result.type !== "clarify") await redis(["SET", cacheKey, JSON.stringify(result), "EX", 86400]);
    await countIt(result);
    return res.status(200).json(result);
  } catch (e) {
    console.error("search error:", e && e.message);
    return res.status(502).json({ error: "The search had trouble with that one. Please try again.", detail: String((e && e.message) || "").slice(0, 200) });
  }
}
