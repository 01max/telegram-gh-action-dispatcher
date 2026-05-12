import { TelegramUpdate, ProjectConfig } from './types';

/** Match a project by the X-Telegram-Bot-Api-Secret-Token header. */
export function resolveProjectBySecretToken(
  request: Request,
  projects: ProjectConfig[]
): ProjectConfig | null {
  const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!token) return null;
  return projects.find(p => p.webhook_secret === token) ?? null;
}

/**
 * Extract the first bot command and its arguments from a Telegram update.
 * Returns the lowercased command name (with @bot suffix stripped) plus args text.
 */
export function parseCommand(
  update: TelegramUpdate
): { name: string; args: string } | null {
  if (!update.message?.text || !update.message?.entities) return null;

  for (const entity of update.message.entities) {
    if (entity.type === 'bot_command') {
      const fullCommand = update.message.text.slice(
        entity.offset,
        entity.offset + entity.length
      );
      const atIndex = fullCommand.indexOf('@');
      const name = (atIndex > 0 ? fullCommand.slice(0, atIndex) : fullCommand)
        .slice(1)
        .toLowerCase();
      const args = update.message.text
        .slice(entity.offset + entity.length)
        .trim();

      return { name, args };
    }
  }

  return null;
}
