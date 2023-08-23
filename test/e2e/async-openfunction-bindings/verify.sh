#!/bin/bash

data_result=$(KUBECONFIG=/tmp/e2e-k8s.config kubectl logs --tail=1 -l app="async-openfunction-bindings-target" -c my-async-openfunction-bindings-target)

echo $data_result