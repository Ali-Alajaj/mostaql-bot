require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const twilio = require("twilio");

// ─── Config ────────────────────────────────────────────────────────────────
const MOSTAQL_URL =
  "https://mostaql.com/projects?skills=html,html5,CSS3,css,javascript,Front-End,%D8%A8%D8%B1%D9%85%D8%AC%D8%A9-%D9%85%D9%88%D8%A7%D9%82%D8%B9,%D8%AA%D8%B5%D9%85%D9%8A%D9%85-%D9%88%D9%8A%D8%A8,website-design,UIUX,node-js,express-js,landing-pages,Landing-Page-Creation&sort=latest";

const CHECK_INTERVAL_MS = 30 * 1000;

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ─── State ──────────────────────────────────────────────────────────────────
const seenProjects = new Set();
let isFirstRun = true;

// ─── Scraper ────────────────────────────────────────────────────────────────
async function fetchProjects() {
  const { data } = await axios.get(MOSTAQL_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "ar,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Cache-Control": "max-age=0",
    },
    timeout: 15000,
  });

  const $ = cheerio.load(data);

  // Debug: print page title and first 300 chars to confirm we're getting real HTML
  console.log("  📄 Page title:", $("title").text().trim());
  console.log("  📄 HTML preview:", data.substring(0, 300).replace(/\n/g, " "));

  const projects = [];

  // Try all possible selectors Mostaql might use
  const selectors = [
    "tr.project-row",
    ".project--card",
    ".project--row",
    "article.project",
    ".projects-list li",
    "table.projects-table tbody tr",
    "[data-project-id]",
    ".project_title a",
    "h2.project__title a",
    "h3.project__title a",
    ".project-title-row a",
  ];

  for (const selector of selectors) {
    const found = $(selector);
    if (found.length > 0) {
      console.log(`  ✅ Selector "${selector}" matched ${found.length} elements`);
    }
  }

  // Main approach: find all links to /projects/ pages
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    // Match links like /projects/12345 or /projects/12345-title
    if (href && /\/projects\/\d+/.test(href)) {
      const url = href.startsWith("http") ? href : `https://mostaql.com${href}`;
      // Deduplicate by URL
      if (!projects.find((p) => p.id === url)) {
        const title = $(el).text().trim() || "مشروع جديد";
        if (title.length > 3) { // Skip very short/empty link texts
          projects.push({ id: url, title, url });
        }
      }
    }
  });

  console.log(`  🔍 Found ${projects.length} project links total`);
  return projects;
}

// ─── WhatsApp Sender ─────────────────────────────────────────────────────────
async function sendWhatsApp(message) {
  await twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${process.env.MY_PHONE_NUMBER}`,
    body: message,
  });
}

// ─── Main Check Loop ─────────────────────────────────────────────────────────
async function checkForNewProjects() {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Checking for new projects...`);
    const projects = await fetchProjects();

    if (projects.length === 0) {
      console.log("  ⚠️  No projects found — page structure may have changed.");
      return;
    }

    if (isFirstRun) {
      projects.forEach((p) => seenProjects.add(p.id));
      console.log(`  ✅ First run: seeded ${seenProjects.size} existing projects. Watching for NEW ones...`);
      isFirstRun = false;
      return;
    }

    const newProjects = projects.filter((p) => !seenProjects.has(p.id));

    if (newProjects.length === 0) {
      console.log("  — No new projects.");
      return;
    }

    console.log(`  🆕 Found ${newProjects.length} new project(s)! Sending notifications...`);

    for (const project of newProjects) {
      seenProjects.add(project.id);

      const message =
        `🆕 *مشروع جديد على مستقل!*\n\n` +
        `📌 ${project.title}\n\n` +
        `🔗 ${project.url}`;

      await sendWhatsApp(message);
      console.log(`  📤 Sent: ${project.url}`);

      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
console.log("🤖 Mostaql WhatsApp Bot started!");
console.log(`   Checking every ${CHECK_INTERVAL_MS / 1000}s...\n`);

checkForNewProjects();
setInterval(checkForNewProjects, CHECK_INTERVAL_MS);