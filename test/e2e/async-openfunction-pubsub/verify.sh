#!/bin/bash

data_result=$(KUBECONFIG=/tmp/e2e-k8s.config kubectl logs --tail=1 -l app="async-openfunction-pubsub-subscriber" -c my-async-openfunction-pubsub-subscriber)

echo $data_result