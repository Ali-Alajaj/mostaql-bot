# 🤖 Mostaql WhatsApp Bot

Monitors [Mostaql.com](https://mostaql.com) for new frontend/web projects every 30 seconds and sends a WhatsApp message to your phone when a new project is posted.

---

## 🗂️ Project Structure

```
mostaql-bot/
├── index.js          # Main bot logic
├── package.json
├── .env              # Your secrets (never commit this!)
├── .env.example      # Template for env variables
└── .gitignore
```

---

## ✅ Full Setup Checklist

### 1. Local Setup

```bash
# Clone or create the folder, then:
npm install
cp .env.example .env   # Then fill in your real values
```

### 2. Get Twilio Credentials (Free)

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio) and create a free account
2. From the **Console Dashboard**, copy:
   - `ACCOUNT SID` → paste as `TWILIO_ACCOUNT_SID` in `.env`
   - `AUTH TOKEN` → paste as `TWILIO_AUTH_TOKEN` in `.env`

### 3. Activate the WhatsApp Sandbox

1. In Twilio Console → **Messaging** → **Try it out** → **Send a WhatsApp message**
2. You'll see a sandbox number (usually `+1 415 523 8886`)
3. Send the join code (e.g. `join <word>-<word>`) from YOUR WhatsApp to that number
4. Once you get the confirmation reply, the sandbox is active
5. Set `TWILIO_WHATSAPP_FROM=+14155238886` in `.env`
6. Set `MY_PHONE_NUMBER=+9665XXXXXXXX` (your number with country code)

> ⚠️ **Sandbox limitation**: You must re-send the join message every 72 hours.  
> For a permanent solution, apply for a [Twilio WhatsApp Sender](https://www.twilio.com/whatsapp/request-access).

### 4. Run Locally

```bash
npm start
```

You should see:
```
🤖 Mostaql WhatsApp Bot started!
   Checking every 30s for new projects...

[12:00:00] Checking for new projects...
  ✅ First run: seeded 20 existing projects. Watching for NEW ones...
```

---

## 🚀 Deploy to Render

1. Push your code to GitHub (**make sure `.env` is in `.gitignore`** — never push it!)

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/mostaql-bot.git
git push -u origin main
```

2. Go to [https://render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub repo
4. Fill in:
   | Field | Value |
   |-------|-------|
   | **Environment** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Instance Type** | `Free` |

5. Go to **Environment** tab → Add these variables (same as your `.env`):
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM`
   - `MY_PHONE_NUMBER`

6. Click **Deploy**! 🎉

> ⚠️ **Render Free Tier Note**: Free web services spin down after 15 minutes of inactivity.  
> To keep the bot always running, use a **Background Worker** instead of a Web Service in Render (same settings, just select "Background Worker" as the type). Background Workers don't spin down.

---

## 🔧 Troubleshooting

| Problem | Fix |
|---------|-----|
| No projects found | Mostaql may have changed its HTML — open DevTools on the site and check the project card selector, then update `index.js` |
| WhatsApp message not received | Make sure you sent the sandbox join code within the last 72 hours |
| Bot works locally but not on Render | Double-check all 4 env variables are set in Render's Environment tab |
| 401 Twilio error | Your `ACCOUNT_SID` or `AUTH_TOKEN` is wrong |
