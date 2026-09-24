# HOME — private sync service

This is a self-hosted replacement for Notion as the HOME Android app's shared task and learning store. Requires Node.js 22.13+ and persistent disk; no cloud account or AI subscription is required just to run the service. A private access token protects the API. The service does **not** read email or calendar by itself.

## Run locally

```sh
cd server
export HOME_TOKEN="$(openssl rand -hex 32)"
export HOME_DB="./home.sqlite"
npm test
npm start
```

The default listener is **127.0.0.1:8787**. Keep the token outside git; back up the database securely. The phone needs a persistent **HTTPS** address and the same token. Put a trusted HTTPS reverse proxy in front of the local listener, restrict access to your own account/network, and do not expose the bare HTTP port. Do not paste the token into ChatGPT, an issue, or a repository. The app stores it encrypted using the device's Android Keystore.

In the Android app, open To-Dos → **Connect HOME** and enter the HTTPS origin and token. The first connection imports local tasks and card definitions without deleting local data. The local offline snapshot remains usable if the service is unavailable. Import is idempotent by ID. Existing historical quiz results without the original written sentence cannot be reconstructed; subsequent attempts retain the selected answer and full sentence.

## API

Every request requires `Authorization: Bearer <HOME_TOKEN>`. Routes: `GET /v1/snapshot`; `POST /v1/tasks` (title, optional task-specific details); `POST /v1/tasks/{id}/done` (`{"done":true}`); `POST /v1/cards`; `POST /v1/attempts` (`id`, `cardId`, `selected` 0–3, `sentence`); `POST /v1/import`; `POST /v1/activity` (`kind` = `calendar_summary`, `mail_candidate`, `habit_observation`, structured `body`). The activity endpoint only records observations: it does not silently create tasks or fetch private mail. Quiz attempts are initially **unscored** for the written component; an assessor must compare the sentence with the card's rubric and award 0–60 with feedback. The correct multiple-choice option contributes 40 automatically. Topic averages and review intervals derive from assessed evidence.

## ChatGPT integration boundary

`POST /mcp` provides a minimal streamable-HTTP-style MCP interface with snapshot, task creation/completion, card creation and written-answer assessment tools. It currently accepts the same static bearer token as the Android API; **do not expose this endpoint publicly or claim it is a connected ChatGPT plugin**. A ChatGPT-facing installation still needs a reachable HTTPS host and a proper OAuth authorization layer (with per-user tokens/scopes and consent) or an appropriate private gateway. Follow the [official MCP server guide](https://developers.openai.com/plugins/build/mcp-server) and [connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt) to finish that deployment. The tool surface does not run a model on its own; an authorized assistant or worker must call it to assess answers and select fresh articles.

For mail, use a separate read-only Gmail/Google OAuth integration with limited scope and explicit review rules before converting a message into a task; don't store mail credentials in the Android bundle. For news, verify the original publisher/date and source before adding a card. Daily multi-pass personalization requires an always-on host and scheduler with a bounded budget. Local calendar display continues to use Android's read-only calendar permission. Do not switch off an existing workflow until a hosted connection and a real device test succeed.
