# Upgrading

## v1 → v2 (env vars → KV)

v1 used env vars `GITHUB_REPO` and `ALLOWED_CHAT_IDS` for single-project routing. v2 introduced Cloudflare KV for multi-project routing.

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

No changes needed in consuming repo. The `repository_dispatch` payload format is identical.

---

## v2 → v3 (single bot token → per-project bot tokens)

v2 used a single `TELEGRAM_BOT_TOKEN` wrangler secret shared across all projects. v3 moves the bot token into each project's entry in KV, so each project can have its own Telegram bot.

### What changed

- `TELEGRAM_BOT_TOKEN` wrangler secret removed (down to 2 secrets)
- Bot tokens live in `projects.json` as a `bot_token` field per project
- `/register` endpoint replaced by `/register-all` (reads all tokens from KV)
- `register-webhook.sh` updated to call `/register-all`

### Migration steps

1. **Update `projects.json`**, add `bot_token` to each project entry:

   ```json
   [
     {
       "repo": "your-username/your-repo",
       "chat_ids": [1234567890],
       "bot_token": "YOUR_BOT_TOKEN"
     }
   ]
   ```

2. **Delete the old secret:**
   ```bash
   cd worker && npx wrangler secret delete TELEGRAM_BOT_TOKEN
   ```

3. **Re-seed KV:**
   ```bash
   cd ..
   ./scripts/seed-kv.sh <your-kv-namespace-id>
   ```

4. **Redeploy:**
   ```bash
   cd worker && npx wrangler deploy
   ```

5. **Re-register webhooks:**
   ```bash
   curl -X POST https://your-worker.workers.dev/register-all \
     -H "X-Setup-Token: <WEBHOOK_SECRET>"
   ```

No changes needed in consuming repos. The `bin/handle_command` contract and `repository_dispatch` payload are identical.

---

## v3 → v4 (shared webhook secret → per-project webhook secrets)

v3 used a single `WEBHOOK_SECRET` wrangler secret verified against incoming webhooks. v4 moves the webhook secret into each project's entry in KV, so each bot token gets its own secret. This allows the worker to distinguish which bot received a message when multiple bots share the same chat (e.g., a user DMs two different bots but their `chat.id` is the same).

### What changed

- `webhook_secret` added to `projects.json` — each project has its own secret
- `/webhook` no longer uses the shared `WEBHOOK_SECRET`; instead, the incoming `X-Telegram-Bot-Api-Secret-Token` header is matched against each project's stored secret
- `/register-all` now registers each bot with its own `webhook_secret` (instead of the shared one)
- The shared `WEBHOOK_SECRET` wrangler secret is kept — still used for `/flush` and `/register-all` admin endpoints

### Migration steps

1. **Update `projects.json`** — add a unique `webhook_secret` to each project entry:

   ```json
   [
     {
       "repo": "your-username/your-repo",
       "chat_ids": [1234567890],
       "bot_token": "YOUR_BOT_TOKEN",
       "webhook_secret": "YOUR_WEBHOOK_SECRET"
     },
     {
       "repo": "your-username/your-other-repo",
       "chat_ids": [1234567890],
       "bot_token": "YOUR_OTHER_BOT_TOKEN",
       "webhook_secret": "YOUR_OTHER_WEBHOOK_SECRET"
     }
   ]
   ```

   Each project needs a **different** secret. Generate via `openssl rand -hex 16`.

2. **Re-seed KV:**
   ```bash
   ./scripts/seed-kv.sh <your-kv-namespace-id>
   ```

3. **Redeploy:**
   ```bash
   cd worker && npx wrangler deploy
   ```

4. **Re-register webhooks:**
   ```bash
   curl -X POST https://your-worker.workers.dev/register-all \
     -H "X-Setup-Token: <WEBHOOK_SECRET>"
   ```
   The worker now registers each bot's webhook with its unique secret token, so Telegram sends the correct `X-Telegram-Bot-Api-Secret-Token` header per bot.

No changes needed in consuming repos. The `bin/handle_command` contract and `repository_dispatch` payload are identical.
