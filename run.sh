#!/bin/bash

docker stop rippled
docker rm rippled
docker rmi xrptipbot/rippled:latest
docker run -dit     --name rippled     -p 80:80 --net=host     -v /rippled/:/config/     xrptipbot/rippled:latest
