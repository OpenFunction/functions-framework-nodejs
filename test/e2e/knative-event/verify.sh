#!/bin/bash

ip=$1
port=$2
url="http://$ip:$port"
headers="Content-Type":"application/json"
body='
{
    "context": {
        "eventId": "testEventId",
        "timestamp": "testTimestamp",
        "eventType": "testEventType",
        "resource": "testResource"
    },
    "data": {
        "Hello": "Openfunction-Nodejs-Knative-Event"
    }
}
'

while true; do
    st=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$headers" -d "$body" "$url")
    if [ "$st" -eq 204 ]; then
        data_result=$(KUBECONFIG=/tmp/e2e-k8s.config kubectl logs --tail=1 -l app="knative-event" -c my-knative-event)
        break
    else
        sleep 1
        continue
    fi
done

echo $data_result
