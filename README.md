# telegram-gh-action-dispatcher

A reusable GitHub Action + Cloudflare Worker that replaces cron-based Telegram bot polling with instant webhook delivery.

## How it works

```
Telegram webhook ──▶ Cloudflare Worker ──▶ repository_dispatch ──▶ GitHub Action ──▶ bin/handle_command
```

1. User sends a `/` command in Telegram (`/disable` for example)
2. Telegram sends a webhook POST to your Cloudflare Worker
3. Worker validates the request, parses the command, and calls GitHub's `repository_dispatch` API
4. A workflow in your project picks up the dispatch and runs this action
5. The action calls your project's `bin/handle_command` script

## Consuming this action

### 1. Create `bin/handle_command`

Each project must provide an executable `bin/handle_command` that accepts 4 positional arguments:

```
bin/handle_command <command> <chat_id> <args> <bot_token>
```

| Arg | Description | Example |
|-----|-------------|---------|
| `command` | Detected command name (from Telegram) | `disable` |
| `chat_id` | Telegram chat ID that sent the command | `7457792489` |
| `args` | Everything after the command in the message | `check.yml` |
| `bot_token` | Telegram bot token (for sending replies) | `12345:ABC...` |

The script can be written in any language. The only contract is the positional argument order and that the script exits with code 0 on success.

#### Ruby example

```ruby
#!/usr/bin/env ruby
command, chat_id, args, bot_token = ARGV

require 'bundler/setup'
require 'net/http'
require 'json'

# --- Your command handling logic ---

case command
when 'disable' # e.g. call GitHub API to disable a workflow
  puts "Disabling workflow: #{args}"
when 'enable'
  puts "Enabling workflow: #{args}"
when 'config'
  config = File.read('config.yml')
  puts "Config: #{config}"
else
  puts "Unknown command: #{command}"
end

# --- Send reply to Telegram (optional) ---
uri = URI("https://api.telegram.org/bot#{bot_token}/sendMessage")
Net::HTTP.post(uri, {
  chat_id: chat_id,
  text: "Command `#{command}` processed.",
  parse_mode: 'Markdown'
}.to_json, 'Content-Type' => 'application/json')
```

### 2. Add a workflow

Create `.github/workflows/user_command.yml` in your project:

```yaml
name: Telegram User Command

on:
  repository_dispatch:
    types: [user-command]

jobs:
  handle:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: 01max/telegram-gh-action-dispatcher@v1
        with:
          command: ${{ github.event.client_payload.command }}
          chat_id: ${{ github.event.client_payload.chat_id }}
          args: ${{ github.event.client_payload.args }}
          bot_token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

Add any setup steps your handler needs (language setup, config files, etc.) before the action call.

---

## Deploying the Cloudflare Worker

A single Worker handles Telegram commands for any number of GitHub repos. Routing is defined in a Cloudflare KV namespace.

### Prerequisites

- Node.js 20+
- A Cloudflare account (free tier is sufficient)
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))

### Setup

```bash
# 1. Clone this repo
git clone https://github.com/01max/telegram-gh-action-dispatcher.git
cd telegram-gh-action-dispatcher

# 2. Install dependencies
cd worker && npm install && cd ..

# 3. Configure wrangler.toml
cp worker/wrangler.toml.example worker/wrangler.toml

# 4. Create a KV namespace
npx wrangler kv namespace create dispatcher_kv
#   → Copy the namespace ID from the output and paste it into worker/wrangler.toml
#     under id = "..."

# 5. Create projects.json with your repo/chat mappings
cp projects.example.json projects.json
#   → Edit projects.json — list each repo and its authorized chat IDs

# 6. Seed the KV namespace
./scripts/seed-kv.sh <your-kv-namespace-id>

# 7. Set secrets
cd worker
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put WEBHOOK_SECRET

# 8. Deploy
npx wrangler deploy
```

### Register the webhook (one-time)

After deploying, register the worker URL as your Telegram bot's webhook:

```bash
./scripts/register-webhook.sh https://your-worker.username.workers.dev <WEBHOOK_SECRET>
```

This calls the worker's `/register` endpoint, which calls Telegram's `setWebhook` API. After this, your bot will stop accepting `getUpdates` polling and start sending webhooks to the worker.

---

## Worker API

### `POST /webhook`

Called by Telegram when a user sends a message. Expects a `X-Telegram-Bot-Api-Secret-Token` header matching `WEBHOOK_SECRET`.

If the message contains a bot command from a chat that maps to a configured project (via KV), the worker dispatches a `repository_dispatch` event to that repo and responds with `200 OK`.

### `POST /register`

Admin endpoint for registering the webhook with Telegram. Expects a `X-Setup-Token` header matching `WEBHOOK_SECRET`. Calls `setWebhook` on the Telegram API and returns the result.

### `POST /flush`

Clears the in-memory KV config cache, forcing the next request to re-read from KV. Expects a `X-Setup-Token` header matching `WEBHOOK_SECRET`. Useful after updating the KV config so changes take effect immediately instead of waiting up to 60 seconds.

```bash
curl -X POST https://your-worker.username.workers.dev/flush \
  -H "X-Setup-Token: <WEBHOOK_SECRET>"
```

---

## Environment reference

### Worker bindings (in `wrangler.toml`)

The repo ships with a `wrangler.toml.example` (template for new projects). Consumer projects should copy the example and edit:

```bash
cp worker/wrangler.toml.example worker/wrangler.toml
```

| Binding | Type | Description |
|---------|------|-------------|
| `DISPATCHER_KV` | KV namespace | Stores the project routing config (key `"projects"`, JSON array of `{ repo, chat_ids }`) |

### Worker secrets (`wrangler secret put`)

| Secret | Description |
|--------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) |
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope (needs access to every configured repo for `repository_dispatch`) |
| `WEBHOOK_SECRET` | Random string used to verify incoming webhook requests and protect admin endpoints |

---

## Upgrading from v1

v1 used env vars `GITHUB_REPO` and `ALLOWED_CHAT_IDS` for single-project routing. v2 uses Cloudflare KV for multi-project routing.

### Migration steps

1. **Create a KV namespace:**
   ```bash
   npx wrangler kv namespace create dispatcher_kv
   ```
   Note the namespace ID in the output.

2. **Create and seed `projects.json`:**
   ```bash
   cp projects.example.json projects.json
   # Edit with your project/chat mappings
   ./scripts/seed-kv.sh <your-kv-namespace-id>
   ```

3. **Update `wrangler.toml`:**
   - Remove the `[vars]` section (drop `ALLOWED_CHAT_IDS`, `GITHUB_REPO`)
   - Add the `[[kv_namespaces]]` block with your namespace ID

4. **Redeploy:**
   ```bash
   npx wrangler deploy
   ```

No changes needed in consuming repos (doctowatch, etc.) — the `repository_dispatch` payload format is identical.

---

## Development

```bash
cd worker
npm install
npm run dev        # Start local dev server
npm run type-check # TypeScript check
npm test           # Run tests
```
