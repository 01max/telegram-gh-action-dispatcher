import { TelegramUpdate, ProjectConfig } from './types';

export function validateSecretToken(
  request: Request,
  webhookSecret: string
): boolean {
  const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return token === webhookSecret;
}

export function lookupProject(
  chatId: number,
  projects: ProjectConfig[]
): ProjectConfig | null {
  return projects.find(p => p.chat_ids.includes(chatId)) ?? null;
}

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
