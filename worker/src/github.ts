export async function dispatchCommand(
  repo: string,
  token: string,
  command: string,
  chatId: number,
  args: string,
  messageId: number
): Promise<boolean> {
  if (!repo.includes('/')) {
    throw new Error(`Invalid repo "${repo}": must be owner/repo`);
  }
  const [owner, repoName] = repo.split('/');

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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
