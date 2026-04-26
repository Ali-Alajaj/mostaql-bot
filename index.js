require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const twilio = require("twilio");

// ─── Config ────────────────────────────────────────────────────────────────
const MOSTAQL_URL =
  "https://mostaql.com/projects?skills=html,html5,CSS3,css,javascript,Front-End,%D8%A8%D8%B1%D9%85%D8%AC%D8%A9-%D9%85%D9%88%D8%A7%D9%82%D8%B9,%D8%AA%D8%B5%D9%85%D9%8A%D9%85-%D9%88%D9%8A%D8%A8,website-design,UIUX,node-js,express-js,landing-pages,Landing-Page-Creation&sort=latest";

const CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ─── State ──────────────────────────────────────────────────────────────────
// Stores IDs/URLs of projects already seen so we don't re-notify
const seenProjects = new Set();
let isFirstRun = true;

// ─── Scraper ────────────────────────────────────────────────────────────────
async function fetchProjects() {
  const { data } = await axios.get(MOSTAQL_URL, {
    headers: {
      // Mimic a real browser so Mostaql doesn't block the request
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "ar,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    },
    timeout: 15000,
  });

  const $ = cheerio.load(data);
  const projects = [];

  // Mostaql wraps each project in a <tr> inside #projects-table,
  // or in .project--row cards. We target both selectors to be safe.
  $("table#projects-table tbody tr, .projects-list .project--row").each(
    (_, el) => {
      // Try the table layout first
      let titleEl = $(el).find("h2.project__title a, h3.project__title a");
      if (!titleEl.length) {
        // Fallback for card layout
        titleEl = $(el).find("a.project-title, a[href*='/projects/']").first();
      }

      const href = titleEl.attr("href") || $(el).find("a[href*='/projects/']").first().attr("href");
      const title = titleEl.text().trim() || "مشروع جديد";

      if (href) {
        const url = href.startsWith("http")
          ? href
          : `https://mostaql.com${href}`;
        projects.push({ id: url, title, url });
      }
    }
  );

  return projects;
}

// ─── WhatsApp Sender ─────────────────────────────────────────────────────────
async function sendWhatsApp(message) {
  await twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`, // e.g. whatsapp:+14155238886
    to: `whatsapp:${process.env.MY_PHONE_NUMBER}`,         // e.g. whatsapp:+9665XXXXXXXX
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
      // On first run: seed the set so we don't flood the user with old projects
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

      // Small delay between messages to respect Twilio rate limits
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
console.log("🤖 Mostaql WhatsApp Bot started!");
console.log(`   Checking every ${CHECK_INTERVAL_MS / 1000}s for new projects...\n`);

checkForNewProjects(); // Run immediately on startup
setInterval(checkForNewProjects, CHECK_INTERVAL_MS);
