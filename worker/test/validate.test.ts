import { describe, it, expect } from 'vitest';
import { lookupProject, parseCommand } from '../src/validate';
import { ProjectConfig, TelegramUpdate } from '../src/types';

const sampleProjects: ProjectConfig[] = [
  { repo: '01max/doctowatch', chat_ids: [123, 456] },
  { repo: '01max/other', chat_ids: [789] },
];

function makeUpdate(overrides: Partial<TelegramUpdate>): TelegramUpdate {
  return {
    update_id: 1,
    ...overrides,
  };
}

describe('lookupProject', () => {
  it('finds project by chat ID', () => {
    expect(lookupProject(123, sampleProjects)).toEqual(sampleProjects[0]);
  });

  it('finds second project', () => {
    expect(lookupProject(789, sampleProjects)).toEqual(sampleProjects[1]);
  });

  it('returns null for unknown chat', () => {
    expect(lookupProject(999, sampleProjects)).toBeNull();
  });

  it('returns null for empty config', () => {
    expect(lookupProject(123, [])).toBeNull();
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
