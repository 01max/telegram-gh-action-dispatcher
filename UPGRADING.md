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
       "repo": "01max/doctowatch",
       "chat_ids": [7457792489],
       "bot_token": "8476020222:ABC..."
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
