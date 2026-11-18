Feature: Xentropy tools in the pi coding agent (@xentropy/pi)
  As a pi user
  I want pi to use my Xentropy workspace
  So that the agent can build and manage artifacts and dashboards for me

  # Automated in pi/tests/extension.test.ts and pi/tests/package.test.ts; smoke in pi/tests/smoke/sdk-smoke.ts.

  Scenario: [H-C1] No API key
    Given XENTROPY_API_KEY is not set
    When a pi session starts
    Then no Xentropy tools are registered
    And pi shows a one-line hint naming XENTROPY_API_KEY and /xentropy-login

  Scenario: [H-C2] Tools are registered with a prefix
    Given a valid API key and a reachable Xentropy MCP server
    When a pi session starts
    Then each MCP tool is registered as xentropy_<tool> with its JSON schema, description and annotations

  Scenario: [H-C3] Calls are forwarded
    When the model calls xentropy_artifacts_list with {"limit": 5}
    Then the extension sends tools/call artifacts_list with {"limit": 5}
    And text and image content reach the model, and other content becomes a text note

  Scenario: [H-C4] Server errors
    When the server answers a call with isError
    Then pi reports an error result with the server's message

  Scenario: [H-C5] Cancelling a call
    When the user aborts a running Xentropy call
    Then the call stops promptly with a cancellation error

  Scenario: [H-C6] Tools that change data
    Given a tool with destructiveHint true, or with no read-only hint
    Then its description starts with "Changes or deletes data."

  Scenario: [H-C7] Only https servers
    Given XENTROPY_MCP_URL is plain http on a host other than localhost
    When a pi session starts
    Then the server is not contacted and pi shows an error naming https

  Scenario: [H-C8] The key stays secret
    Then requests carry "Authorization: Bearer <key>"
    And the key never appears in notices, command output, tool definitions or console logs

  Scenario: [H-C9] Connection failure
    Given the server is unreachable or rejects the key
    When a pi session starts
    Then pi keeps running, registers no tools and shows "could not connect" with the reason

  Scenario: [H-C10] Tool lists are refreshed (Q17)
    Given the server's tool list changed since the last session
    When a new session starts
    Then new tools are registered and withdrawn tools are hidden

  Scenario: [H-C11] Provider-safe tool names
    Then every tool name matches ^xentropy_[A-Za-z0-9_]+$, has at most 64 characters and is unique

  Scenario: [H-C12] Commands
    When the user runs /xentropy-status
    Then pi shows the server, connection state, tool count and auth mode
    When the user runs /xentropy-login
    Then pi shows the steps and https://xentropy.ai/settings/api-keys with the Agent preset
