#!/bin/bash

ip=$1
port1=$2
port2=$3
port3=$4
port4=$5
port5=$6
port6=$7

saveURL="http://$ip:$port1"
getURL="http://$ip:$port2"
getBulkURL="http://$ip:$port3"
deleteURL="http://$ip:$port4"
transactionURL="http://$ip:$port5"
queryURL="http://$ip:$port6"

headers="Content-Type: application/json"

toSendSave='{
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

toSendGet='{
  "key": "1"
}'

toSendGetBulk='{
    "keys": ["1", "2"],
    "parallelism": 10
}'

toSendDelete='{
  "key": "1"
}'

toSendTransaction='{
    "operations": [
      {
        "operation": "delete",
        "request": {
          "key": "2"
        }
      },
      {
        "operation": "upsert",
        "request": {
          "key": "1",
          "value": {
            "person": {
              "org": "Dev Ops",
              "id": "1036"
            },
            "city": "Seattle",
            "state": "WA"
          }
        }
      }
    ]
}'

toSendQuery='{
    "query": {
      "filter": {
        "EQ": {
          "state": "WA"
        }
      },
      "sort": [
        {
          "key": "person.id",
          "order": "DESC"
        }
      ],
      "page": {
        "limit": 1
      }
    }
}'

curl -s -X POST -H "$headers" -d "$toSendSave" "$saveURL"
curl -s -X POST -H "$headers" -d "$toSendGet" "$getURL"
curl -s -X POST -H "$headers" -d "$toSendGetBulk" "$getBulkURL"
curl -s -X POST -H "$headers" -d "$toSendDelete" "$deleteURL"
curl -s -X POST -H "$headers" -d "$toSendTransaction" "$transactionURL"
curl -s -X POST -H "$headers" -d "$toSendQuery" "$queryURL"

data_result=$(KUBECONFIG=/tmp/e2e-k8s.config kubectl logs -l app="knative-openfunction-state-query" -c my-knative-openfunction-state-query --tail=1)

echo $data_result
