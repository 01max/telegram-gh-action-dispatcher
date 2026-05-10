import { Env } from './types';

export async function dispatchCommand(
  env: Env,
  command: string,
  chatId: number,
  args: string,
  messageId: number
): Promise<boolean> {
  const [owner, repo] = env.GITHUB_REPO.split('/');

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'telegram-gh-action-dispatcher',
      },
      body: JSON.stringify({
        event_type: 'user-command',
        client_payload: {
          command,
          chat_id: String(chatId),
          args,
          message_id: String(messageId),
        },
      }),
    }
  );

  return response.ok;
}
