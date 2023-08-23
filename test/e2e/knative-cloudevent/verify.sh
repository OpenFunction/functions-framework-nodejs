#!/bin/bash

ip=$1
port=$2
url="http://$ip:$port"
headers="Content-Type: application/cloudevents+json"
body='
{
    "specversion": "1.0",
    "id": "test-1234-1234",
    "type": "ce.openfunction",
    "time": "2020-05-13T01:23:45Z",
    "subject": "test-subject",
    "source": "https://github.com/OpenFunction/functions-framework-nodejs",
    "datacontenttype": "application/json",
    "data": {
        "Hello": "Openfunction-Nodejs-Knative-Cloudevent"
    }
}
'

while true; do
    st=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "$headers" -d "$body" "$url")
    if [ "$st" -eq 204 ]; then
        data_result=$(KUBECONFIG=/tmp/e2e-k8s.config kubectl logs --tail=1 -l app="knative-cloudevent" -c my-knative-cloudevent)
        break
    else
        sleep 1
        continue
    fi
done

echo $data_result
