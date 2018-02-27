# XRP Ledger to MongoDB

Ugly but highly effective scripts to query the XRP ledger for info. Dumps the info into a `json` files and MongoDB.

## Thanks

@Kakoyla for telling me about the `ledger_data` method! 

## Prerequisites

1. Rippled (Websocket) at 127.0.0.1:80
2. MongoDB at 127.0.0.1:27017 - **PLEASE USE A FIREWALL! MONGODB MAY BE INSECURE WITH DEFAULT CONFIG**

I used Docker containers to run these servers;

1. `docker run -dit --name rippled -p 80:80 -v /rippled/:/config/ xrptipbot/rippled:latest`
With [this config](https://github.com/WietseWind/docker-rippled/tree/master/config) (in `/rippled/`)
2. `docker run --name mongo -p 27017:27017 -v /mongodb:/data/db -d mongo:latest`

## Install NPM packages

To run the scripts, install the dependencies: `npm install` (from the checkout directory)

# What to run

- `./run_account_data.sh`
- `./run_escrow_data.sh`

... run the scripts and wait some minutes after execution. The scripts will then run again to update the data in MongoDB.

To test (and run once), execute:

- `node account_data.js`
- `node escrow_data.js`

## Debugging

`.log`-files will be created by the run_\*.sh jobs and by the \*.js-files.

## Run at startup in the backgound

(This is the ugly way) - Edit `/etc/crontab`, and add:

```
@reboot root docker start rippled
@reboot root docker start mongo
@reboot root /bin/bash /ledger/run_account_data.sh 2>&1 > /ledger/run_account_data.log
@reboot root /bin/bash /ledger/run_escrow_data.sh 2>&1 > /ledger/run_escrow_data.log
```
