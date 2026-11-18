## Setup (for the user, not the agent)

The agent never runs these commands and never edits the OpenClaw config: when
the Xentropy tools are missing, it points the user to this section.

1. With the Gateway running, add the server. Always pass the transport:
   OpenClaw defaults to SSE, which Xentropy does not serve.

   ```bash
   openclaw mcp add xentropy --url https://api.xentropy.ai/mcp --transport streamable-http --auth oauth
   ```

2. Sign in and approve access in the browser:

   ```bash
   openclaw mcp login xentropy
   ```

   With `gateway.publicOrigin` set, Xentropy redirects to
   `<publicOrigin>/oauth/mcp/callback` (https); without it, to the Gateway's
   loopback address. Xentropy accepts both.

3. Headless Gateways can use a scoped API key instead of OAuth. Create one
   with the Agent preset at https://xentropy.ai/settings/api-keys, set it as
   `XENTROPY_API_KEY` in the Gateway's environment (never in the config file)
   and use this entry in `openclaw.json`:

   ```json
   {
     "mcp": {
       "servers": {
         "xentropy": {
           "url": "https://api.xentropy.ai/mcp",
           "transport": "streamable-http",
           "headers": { "Authorization": "Bearer ${XENTROPY_API_KEY}" }
         }
       }
     }
   }
   ```

   This skill names `XENTROPY_API_KEY` as its primary key but does not
   require it, so it also loads for OAuth users.

4. For read-only use, add `"toolFilter": { "include": [...] }` with the read
   tools (for example `artifacts_list`, `artifacts_get`, `data_preview`).

Guide: https://docs.xentropy.ai/agents/clients/openclaw
