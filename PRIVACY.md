# Privacy notice: ROQAM – Readout & Quick Access Mod

Last updated: 16 October 2026

This notice covers ROQAM in its English (`roqam`) and German (`roqam-de`) versions.

## In short

- The author runs no server and receives no data from you. ROQAM contains no telemetry, analytics or tracking.
- Everything ROQAM stores stays on your PC.
- The status bar fetches public data (weather, service status, version numbers) from third-party services. Each
  request shows your IP address to that service, and the weather requests also contain the coordinates of your
  location.
- The summary in the top line sends the beginning of each prompt to Claude Haiku through your own Claude Code
  session, so to Anthropic, which already processes your chats.

## Who is responsible

Dominik Sieber wrote ROQAM. It runs entirely inside Claude Code on your computer. The author has no access to your
PC, your Claude account or any data ROQAM handles.

## Requests to third-party services

| Service | When | What it receives |
|---|---|---|
| Open-Meteo geocoding (`geocoding-api.open-meteo.com`) | Once per location; the result is cached on your PC | The town from your location setting |
| Open-Meteo forecast (`api.open-meteo.com`) | Every 10 minutes (weather) and every 30 minutes (cloud cover) | Latitude and longitude of that town |
| 7Timer (`www.7timer.info`) | Every 30 minutes | Latitude and longitude of that town |
| Claude status page (`status.claude.com`) | Every 5 minutes | Only the request itself |
| npm registry (`registry.npmjs.org`) | Every 6 hours | Only the request itself (latest Claude Code version) |
| Your own weather station (`weatherUrl`, only if set together with a location) | Every 10 minutes, instead of the Open-Meteo weather | Only the request itself |
| Frankfurter (`api.frankfurter.app`) | Every 6 hours, German version only, with API costs on (default) | Only the request itself (USD to CHF rate) |

"Only the request itself" means the usual connection data, such as your IP address and the time. ROQAM sends no
account, name, file content or chat content. Each service's own terms and privacy policy apply.

With no location set, ROQAM makes no weather requests at all. After `/stars` it stops the weather requests; only
the one-time lookup of your town can still run at start-up if its result is not cached yet.

## Data that goes through Claude Code to Anthropic or a connector

- Summary in the top line: for each new prompt (not for slash commands), the first 2,000 characters go to
  Claude Haiku through your Claude Code session to get a one-line summary. Anthropic processes this under the
  terms of your Claude account ([Anthropic privacy policy](https://www.anthropic.com/legal/privacy)). It uses a
  small part of your plan.
- System prompt: ROQAM adds a short, fixed instruction to the system prompt that Claude Code sends with each
  request. It contains no personal data.
- Higgsfield credits (only when the Higgsfield connector is connected and `higgsfield` is not set to `false`): ROQAM asks the Higgsfield connector you added in claude.ai
  for your credit balance. The query runs through that connector to Higgsfield.
- "✓ Save" puts a request into the prompt box. Nothing is sent until you send it yourself. The request asks
  Claude to update your project notes and its memory, commit the changed project files and push them if the
  project has an online copy.
- "⇢ Handoff" runs your `/handoff` skill right away if you have one; that skill then works like any prompt you
  send. Without such a skill, it only puts a request into the prompt box.

## Data on your PC

### Read, never sent anywhere

- `~\.claude.json`: the promotion markers (cloud credits, guest passes, discounts, usage-limit notices), for
  "⚑ New promotion", and the start date of your plan, to know when the plan month begins.
- `~\.claude\sessions\`: names and status of running Claude sessions, for "Chats".
- The current chat's transcript under `~\.claude\projects\`: the time of the last answer, for `T−`.
- `~\.claude\statusleiste-guthaben.json` and `~\.claude\github-abgleich.json`, only if you created them: credits you track by hand and the status of your own GitHub sync script.
- With API costs on (the default): all transcripts there. Only times, models and token counts are used, and only
  answers since the start of your plan month count.
- The list of running programs (`tasklist`): to turn on recording mode while OBS, Streamlabs, Bandicam or
  Camtasia runs, and to count running Claude sessions. The list is neither stored nor sent.

### Written

- A file starting with `roqam` in `~\.claude\plugins\store\` (managed by Claude Code): your choices such as
  `/stars` and recording mode, the last promotion you dismissed, and the cached coordinates and time zone of your
  location.
- With API costs on: a cost log in `~\.claude\` (`api-cost-log.json`, German version `api-kostenbuch.json`, each with a backup copy ending in `.bak`), one
  entry per answer with time, cost in USD, project folder and chat ID. It is kept until the end of the plan month
  so that deleted chats still count.
- When it queries Higgsfield: a small text file in the mod folder with the time and result of the last credit query.

### Programs started

ROQAM starts `tasklist` (see above), PowerShell (sounds, and reading large transcripts with API costs on),
`rundll32` (opens a link you click: web pages in your browser, app chats and "+ New" in the Claude desktop app) and `wt.exe` (new terminal window for "+ New").

Recording mode hides paths, costs, accounts and the summary of your request on screen. It does not change what is fetched or stored.

## Removing all data

1. Installed with the plugin manager: `claude plugin uninstall roqam@roqam` (or `roqam-de@roqam`). Installed by
   double-click or by hand: remove the mod path from `CLAUDE_CODE_PLUGIN_DIRS` in `~\.claude\settings.json` and
   delete the folder `roqam` or `roqam-de` in `~\.claude\mods\`.
2. Delete the files starting with `roqam` in `~\.claude\plugins\store\` and, if present, the cost log and its
   `.bak` copy in `~\.claude\`.

Nothing else remains. Server logs at the services listed above follow their own policies.

## Changes

Each new version of ROQAM comes with this notice; the date at the top shows the current one.
