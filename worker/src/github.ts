const BACKOFF_MS = [1000, 2000, 4000];

function shouldRetry(status: number): boolean {
  return status >= 500 || status === 429;
}

/**
 * Trigger a repository_dispatch event on the target GitHub repo.
 * Retries up to 3 times with exponential backoff on 5xx / 429 / network errors.
 * Returns true if the dispatch was accepted (HTTP 2xx).
 */
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
  const url = `https://api.github.com/repos/${owner}/${repoName}/dispatches`;
  const body = JSON.stringify({
    event_type: 'user-command',
    client_payload: {
      command,
      chat_id: String(chatId),
      args,
      message_id: String(messageId),
    },
  });

  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'telegram-gh-action-dispatcher',
        },
        body,
      });

      if (response.ok) return true;

      if (!shouldRetry(response.status)) return false;
    } catch {
      // network error, will retry
    }

    if (attempt < BACKOFF_MS.length) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
    }
  }

  return false;
}
