#!/bin/bash

echo "Starting in 5 minutes..."

sleep 300
cd /ledger/ 

while true; do 
  node escrow_data.js 2>&1 > escrow_data.log && \
  echo $(date)" Done. Restarting (1200)..." && \
  sleep 1200;
done
