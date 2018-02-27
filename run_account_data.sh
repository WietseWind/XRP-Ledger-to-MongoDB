#!/bin/bash

echo "Starting in 1 minute..."
sleep 60; cd /ledger/; while true; node account_data.js 2>&1 > account_data.log && echo $(date)" Done. Restarting (600)..." && sleep 600; done
