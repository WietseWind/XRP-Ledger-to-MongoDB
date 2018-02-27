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
