import { TelegramUpdate, Env, ProjectConfig } from './types';
import { validateSecretToken, parseCommand, lookupProject } from './validate';
import { sendMessage, setWebhook } from './telegram';
import { dispatchCommand } from './github';

let cachedConfig: ProjectConfig[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000;

async function loadConfig(env: Env): Promise<ProjectConfig[]> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL) {
    return cachedConfig;
  }
  const raw = await env.DISPATCHER_KV.get('projects');
  const config: ProjectConfig[] = raw ? JSON.parse(raw) : [];
  cachedConfig = config;
  cacheTimestamp = now;
  return config;
}

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

    if (url.pathname === '/flush' && request.method === 'POST') {
      return handleFlush(request, env);
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

  const chatId = update.message?.chat?.id;
  if (!chatId) {
    return new Response('OK', { status: 200 });
  }

  const config = await loadConfig(env);
  const project = lookupProject(chatId, config);
  if (!project) {
    return new Response('OK', { status: 200 });
  }

  const command = parseCommand(update);
  if (!command) {
    return new Response('OK', { status: 200 });
  }

  const messageId = update.message!.message_id;

  ctx.waitUntil(
    (async () => {
      const ok = await dispatchCommand(
        project.repo,
        env.GITHUB_TOKEN,
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

async function handleFlush(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = request.headers.get('X-Setup-Token');
  if (auth !== env.WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  cachedConfig = null;
  cacheTimestamp = 0;

  return new Response('OK', { status: 200 });
}
