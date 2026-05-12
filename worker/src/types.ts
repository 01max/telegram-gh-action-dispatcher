export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    entities?: Array<{
      type: string;
      offset: number;
      length: number;
    }>;
  };
}

export interface ProjectConfig {
  repo: string;
  chat_ids: number[];
  bot_token: string;
}

export interface Env {
  GITHUB_TOKEN: string;
  WEBHOOK_SECRET: string;
  DISPATCHER_KV: KVNamespace;
}
