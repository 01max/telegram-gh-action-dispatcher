import { TelegramUpdate, Env, ProjectConfig } from './types';
import { resolveProjectBySecretToken, parseCommand } from './validate';
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

    if (url.pathname === '/register-all' && request.method === 'POST') {
      return handleRegisterAll(request, env);
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
  const config = await loadConfig(env);
  const project = resolveProjectBySecretToken(request, config);
  if (!project) {
    return new Response('Invalid secret token', { status: 401 });
  }

  const update: TelegramUpdate = await request.json();

  const chatId = update.message?.chat?.id;
  if (!chatId) {
    return new Response('OK', { status: 200 });
  }

  if (!project.chat_ids.includes(chatId)) {
    return new Response('OK', { status: 200 });
  }

  const command = parseCommand(update);
  if (!command) {
    return new Response('OK', { status: 200 });
  }

  const messageId = update.message!.message_id;

  ctx.waitUntil(dispatchOrNotify(project, env, command.name, chatId, command.args, messageId));

  return new Response('OK', { status: 200 });
}

async function dispatchOrNotify(
  project: ProjectConfig,
  env: Env,
  commandName: string,
  chatId: number,
  args: string,
  messageId: number
): Promise<void> {
  const ok = await dispatchCommand(
    project.repo,
    env.GITHUB_TOKEN,
    commandName,
    chatId,
    args,
    messageId
  );
  if (!ok) {
    await sendMessage(
      project.bot_token,
      chatId,
      `Failed to dispatch command \`${commandName}\`.`
    );
  }
}

async function handleRegisterAll(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = request.headers.get('X-Setup-Token');
  if (auth !== env.WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const webhookUrl = `${url.protocol}//${url.hostname}/webhook`;
  const config = await loadConfig(env);

  if (config.length === 0) {
    return new Response(JSON.stringify({ error: 'No projects configured in KV' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results = await Promise.all(
    config.map(async (project) => {
      const result = await setWebhook(
        project.bot_token,
        webhookUrl,
        project.webhook_secret
      );
      return { repo: project.repo, ...result };
    })
  );

  const allOk = results.every((r) => r.ok);

  return new Response(JSON.stringify(results), {
    status: allOk ? 200 : 207,
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
