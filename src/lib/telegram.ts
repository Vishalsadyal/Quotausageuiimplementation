import { fail } from "./api";

function env(name: string) {
  return String(process.env[name] || "").trim();
}

export function telegramConfigured() {
  return Boolean(env("TELEGRAM_BOT_TOKEN") && env("TELEGRAM_CHAT_ID"));
}

export async function sendTelegramNotification(text: string) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return { ok: false as const, reason: "NOT_CONFIGURED" as const };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const details = await res.text().catch(() => "");
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[Telegram] sendMessage failed", res.status, details);
      }
      return { ok: false as const, reason: "FAILED" as const, status: res.status };
    }
    return { ok: true as const };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[Telegram] sendMessage error", error);
    }
    return { ok: false as const, reason: "FAILED" as const, status: 0 };
  }
}

export function verifyTelegramWebhookSecret(req: Request) {
  const expected = env("TELEGRAM_WEBHOOK_SECRET");
  if (!expected) {
    return { ok: false as const, error: fail("Telegram webhook secret is not configured", 500, "CONFIG_ERROR") };
  }
  const got = String(req.headers.get("x-telegram-bot-api-secret-token") || "").trim();
  if (got !== expected) {
    return { ok: false as const, error: fail("Forbidden", 403, "FORBIDDEN") };
  }
  return { ok: true as const };
}
