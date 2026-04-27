require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const twilio = require("twilio");

const MOSTAQL_URL =
  "https://mostaql.com/projects?skills=html,html5,CSS3,css,javascript,Front-End,%D8%A8%D8%B1%D9%85%D8%AC%D8%A9-%D9%85%D9%88%D8%A7%D9%82%D8%B9,%D8%AA%D8%B5%D9%85%D9%8A%D9%85-%D9%88%D9%8A%D8%A8,website-design,UIUX,node-js,express-js,landing-pages,Landing-Page-Creation&sort=latest";

const CHECK_INTERVAL_MS = 30 * 1000;

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const seenProjects = new Set();
let isFirstRun = true;

async function fetchProjects() {
  const { data, status } = await axios.get(MOSTAQL_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "ar,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Referer": "https://mostaql.com/",
    },
    timeout: 15000,
  });

  const $ = cheerio.load(data);

  // Always log these so we can debug
  console.log("  HTTP Status:", status);
  console.log("  Page title:", $("title").text().trim());
  console.log("  Body length:", data.length);
  console.log("  HTML sample:", data.substring(0, 500).replace(/\s+/g, " "));

  const projects = [];

  // Cast a wide net — grab every unique /projects/NUMBER link
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/\/projects\/\d+/.test(href)) {
      const url = href.startsWith("http") ? href : `https://mostaql.com${href}`;
      const title = $(el).text().trim();
      if (!projects.find((p) => p.id === url) && title.length > 2) {
        projects.push({ id: url, title, url });
      }
    }
  });

  console.log(`  Project links found: ${projects.length}`);
  return projects;
}

async function sendWhatsApp(message) {
  await twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${process.env.MY_PHONE_NUMBER}`,
    body: message,
  });
}

async function checkForNewProjects() {
  try {
    console.log(`\n[${new Date().toLocaleTimeString()}] Checking...`);
    const projects = await fetchProjects();

    if (projects.length === 0) {
      console.log("  ⚠️  No projects found — see HTML sample above for clues.");
      return;
    }

    if (isFirstRun) {
      projects.forEach((p) => seenProjects.add(p.id));
      console.log(`  ✅ Seeded ${seenProjects.size} existing projects. Watching for new ones...`);
      isFirstRun = false;
      return;
    }

    const newProjects = projects.filter((p) => !seenProjects.has(p.id));
    if (newProjects.length === 0) {
      console.log("  — No new projects.");
      return;
    }

    for (const project of newProjects) {
      seenProjects.add(project.id);
      const message = `🆕 *مشروع جديد على مستقل!*\n\n📌 ${project.title}\n\n🔗 ${project.url}`;
      await sendWhatsApp(message);
      console.log(`  📤 Sent: ${project.url}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
  }
}

console.log("🤖 Mostaql WhatsApp Bot v2 started!\n");
checkForNewProjects();
setInterval(checkForNewProjects, CHECK_INTERVAL_MS);