const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SETUP_KEY = process.env.SETUP_KEY;

export default async function handler(req, res) {
  try {
    const { key } = req.query;

    if (!BOT_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "BOT_TOKEN missing"
      });
    }

    if (!SETUP_KEY || key !== SETUP_KEY) {
      return res.status(403).json({
        ok: false,
        error: "Invalid setup key"
      });
    }

    const host = req.headers.host;
    const webhookUrl = `https://${host}/api/telegram`;

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: WEBHOOK_SECRET,
          allowed_updates: ["message"],
          drop_pending_updates: true
        })
      }
    );

    const data = await telegramRes.json();

    return res.status(200).json({
      ok: true,
      webhookUrl,
      telegram: data
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}