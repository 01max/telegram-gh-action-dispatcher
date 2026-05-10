import { describe, it, expect } from 'vitest';
import { isAllowedChat, parseCommand } from '../src/validate';
import { TelegramUpdate } from '../src/types';

function makeUpdate(overrides: Partial<TelegramUpdate>): TelegramUpdate {
  return {
    update_id: 1,
    ...overrides,
  };
}

describe('isAllowedChat', () => {
  it('allows a chat in the list', () => {
    const update = makeUpdate({
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        text: '/test',
      },
    });
    expect(isAllowedChat(update, '123')).toBe(true);
  });

  it('rejects a chat not in the list', () => {
    const update = makeUpdate({
      message: {
        message_id: 1,
        chat: { id: 456, type: 'private' },
        text: '/test',
      },
    });
    expect(isAllowedChat(update, '123')).toBe(false);
  });

  it('handles comma-separated list with spaces', () => {
    const update = makeUpdate({
      message: {
        message_id: 1,
        chat: { id: 789, type: 'private' },
        text: '/test',
      },
    });
    expect(isAllowedChat(update, '123, 456, 789')).toBe(true);
  });

  it('rejects if no message', () => {
    const update = makeUpdate({});
    expect(isAllowedChat(update, '123')).toBe(false);
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
