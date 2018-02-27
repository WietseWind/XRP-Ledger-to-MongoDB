#!/bin/bash

echo "Starting in 5 minutes..."

sleep 300
cd /ledger/ 

while true; do 
  node escrow_data.js 2>&1 > escrow_data.log && \
  echo $(date)" Done. Restarting (600)..." && \
  sleep 600;
done
