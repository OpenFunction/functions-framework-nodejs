#!/bin/bash

ip=$1
port=$2
url="http://$ip:$port"
headers="Content-Type: application/json"

body='{
  "data": [
    {
      "key": "1",
      "value": {
        "person": {
          "org": "Dev Ops",
          "id": 1036
        },
        "city": "Seattle",
        "state": "WA"
      }
    },
    {
      "key": "2",
      "value": {
        "person": {
          "org": "Hardware",
          "id": 1028
        },
        "city": "Portland",
        "state": "OR"
      }
    }
  ]
}'

curl -s -X POST -H "$headers" -d "$body" "$url"

data=$(KUBECONFIG=/tmp/e2e-k8s.config kubectl logs -l app="openfunction-skywalking-plugins" -c my-openfunction-skywalking-plugins --tail=1)

echo $data
