#!/bin/bash

ip=$1
port=$2
url="http://$ip:$port"
headers="Content-Type: application/json"
body='{"Hello": "Openfunction-Nodejs-Knative-Openfunction-Bindings"}'

while true; do
  # st is the get res code
  st=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$headers" -d "$body" "$url")
  if [ "$st" -eq 200 ]; then
    # data_result is the res body
    data_result=$(curl -s -X POST -H "$headers" -d "$body" "$url")
    break
  else
    sleep 1
    continue
  fi
done

echo $data_result
