import { describe, it, expect } from 'vitest';
import { resolveProjectBySecretToken, parseCommand } from '../src/validate';
import { ProjectConfig, TelegramUpdate } from '../src/types';

const sampleProjects: ProjectConfig[] = [
  { repo: '01max/doctowatch', chat_ids: [123, 456], bot_token: 'bot1:abc', webhook_secret: 'secret1' },
  { repo: '01max/other', chat_ids: [789], bot_token: 'bot2:xyz', webhook_secret: 'secret2' },
];

function makeUpdate(overrides: Partial<TelegramUpdate>): TelegramUpdate {
  return {
    update_id: 1,
    ...overrides,
  };
}

function makeRequest(secretToken: string | null): Request {
  const headers = new Headers();
  if (secretToken) {
    headers.set('X-Telegram-Bot-Api-Secret-Token', secretToken);
  }
  return new Request('http://example.com/webhook', { method: 'POST', headers });
}

describe('resolveProjectBySecretToken', () => {
  it('finds project by matching secret token', () => {
    const request = makeRequest('secret1');
    expect(resolveProjectBySecretToken(request, sampleProjects)).toEqual(sampleProjects[0]);
  });

  it('finds second project by secret token', () => {
    const request = makeRequest('secret2');
    expect(resolveProjectBySecretToken(request, sampleProjects)).toEqual(sampleProjects[1]);
  });

  it('returns null for unknown secret token', () => {
    const request = makeRequest('unknown-secret');
    expect(resolveProjectBySecretToken(request, sampleProjects)).toBeNull();
  });

  it('returns null when no secret token header is present', () => {
    const request = makeRequest(null);
    expect(resolveProjectBySecretToken(request, sampleProjects)).toBeNull();
  });

  it('returns null for empty config', () => {
    const request = makeRequest('secret1');
    expect(resolveProjectBySecretToken(request, [])).toBeNull();
  });
});

describe('parseCommand', () => {
  it('parses a simple command', () => {
    const update = makeUpdate({
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        text: '/disable',
        entities: [{ type: 'bot_command', offset: 0, length: 8 }],
      },
    });
    expect(parseCommand(update)).toEqual({ name: 'disable', args: '' });
  });

  it('parses command with args', () => {
    const update = makeUpdate({
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        text: '/config check.yml',
        entities: [{ type: 'bot_command', offset: 0, length: 7 }],
      },
    });
    expect(parseCommand(update)).toEqual({
      name: 'config',
      args: 'check.yml',
    });
  });

  it('strips @botname suffix', () => {
    const update = makeUpdate({
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        text: '/disable@MyBot',
        entities: [{ type: 'bot_command', offset: 0, length: 15 }],
      },
    });
    expect(parseCommand(update)).toEqual({ name: 'disable', args: '' });
  });

  it('returns null for non-command messages', () => {
    const update = makeUpdate({
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        text: 'hello world',
      },
    });
    expect(parseCommand(update)).toBeNull();
  });

  it('returns null when no text is present', () => {
    const update = makeUpdate({
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
      },
    });
    expect(parseCommand(update)).toBeNull();
  });
});
