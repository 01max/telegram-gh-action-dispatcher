import { TelegramUpdate, Env } from './types';
import { validateSecretToken, isAllowedChat, parseCommand } from './validate';
import { sendMessage } from './telegram';
import { dispatchCommand } from './github';
import { setWebhook } from './telegram';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env, ctx);
    }

    if (url.pathname === '/register' && request.method === 'POST') {
      return handleRegister(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (!validateSecretToken(request, env.WEBHOOK_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const update: TelegramUpdate = await request.json();

  if (!isAllowedChat(update, env.ALLOWED_CHAT_IDS)) {
    return new Response('OK', { status: 200 });
  }

  const command = parseCommand(update);
  if (!command) {
    return new Response('OK', { status: 200 });
  }

  const chatId = update.message!.chat.id;
  const messageId = update.message!.message_id;

  ctx.waitUntil(
    (async () => {
      const ok = await dispatchCommand(
        env,
        command.name,
        chatId,
        command.args,
        messageId
      );
      if (!ok) {
        await sendMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          `Failed to dispatch command \`${command.name}\`.`
        );
      }
    })()
  );

  return new Response('OK', { status: 200 });
}

async function handleRegister(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = request.headers.get('X-Setup-Token');
  if (auth !== env.WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const webhookUrl = `${url.protocol}//${url.hostname}/webhook`;

  const result = await setWebhook(
    env.TELEGRAM_BOT_TOKEN,
    webhookUrl,
    env.WEBHOOK_SECRET
  );

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}
