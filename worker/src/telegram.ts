/** Register a Telegram bot webhook for the given URL with a secret token. */
export async function setWebhook(
  botToken: string,
  url: string,
  secretToken: string
): Promise<{ ok: boolean; description?: string }> {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token: secretToken,
        allowed_updates: ['message'],
      }),
    }
  );
  return response.json();
}

/** Send a Markdown message via a Telegram bot. Returns true on HTTP success. */
export async function sendMessage(
  botToken: string,
  chatId: number | string,
  text: string
): Promise<boolean> {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    }
  );
  return response.ok;
}
