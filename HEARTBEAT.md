# HEARTBEAT.md

## Silent Cron Handler
Every 5 minutes a systemEvent fires with text "SILENT_CRON: Make a POST request to http://localhost:3000/api/cron/publish with header x-cron-secret: dev-cron-secret."

When you receive this, do it silently. Reply exactly: NO_REPLY
Do not say anything else. Just execute the curl request.
