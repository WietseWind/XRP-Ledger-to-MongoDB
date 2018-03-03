#!/bin/bash

find /var/www/html/download/ -mmin +59 -exec rm {} \;

echo "Account"
latest=$(find /var/www/html/download/*.json -printf "%T@ %p\n" | sort -nr|grep account_data|grep -v latest|head -n 2|tail -n 1|cut -d " " -f 2)
latestcsv=$(echo "$latest"|sed 's/json/csv/g')
latestcsvt=$(echo "$latestcsv"|sed 's/\//_/g')
rm /var/www/html/download/latest_account_data.json; ln -s $latest /var/www/html/download/latest_account_data.json
json2csv -i $latest > $latestcsvt
mv $latestcsvt $latestcsv
rm /var/www/html/download/latest_account_data.csv; ln -s $latestcsv /var/www/html/download/latest_account_data.csv
zip /var/www/html/download/latest_account_data.csv.zip /var/www/html/download/latest_account_data.csv
zip /var/www/html/download/latest_account_data.json.zip /var/www/html/download/latest_account_data.json

echo "Escrow"
latest=$(find /var/www/html/download/*.json -printf "%T@ %p\n" | sort -nr|grep escrow_data|grep -v latest|head -n 2|tail -n 1|cut -d " " -f 2)
latestcsv=$(echo "$latest"|sed 's/json/csv/g')
latestcsvt=$(echo "$latestcsv"|sed 's/\//_/g')
rm /var/www/html/download/latest_escrow_data.json; ln -s $latest /var/www/html/download/latest_escrow_data.json
json2csv -i $latest > $latestcsvt
mv $latestcsvt $latestcsv
rm /var/www/html/download/latest_escrow_data.csv; ln -s $latestcsv /var/www/html/download/latest_escrow_data.csv
