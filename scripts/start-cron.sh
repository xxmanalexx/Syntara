#!/bin/bash
# Syntara Cron Worker Setup
# Run this on server restart to restore the cron worker

echo "Starting Syntara Cron Worker..."
cd /home/bot/Syntara

# Check if already running
if pm2 list | grep -q syntara-cron; then
    echo "syntara-cron already running"
else
    NODE_ENV=production pm2 start scripts/cron-worker.js --name syntara-cron -o /tmp/syntara-cron.log -e /tmp/syntara-cron.err --time
    echo "syntara-cron started"
fi

pm2 save
echo "Done."
