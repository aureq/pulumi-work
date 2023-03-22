# Docker in Kubernetes

This application demonstrates how to use Pulumi to deploy an EKS cluster, run Dockerd (Docker daemon) and expose it as a service.

This Pulumi application deploys :

- a VPC across your selected AWS region
- a Kubernetes cluster on AWS (EKS)
- a `dockerd` (Docker Daemon) service accessible via a TCP load balancer

Once the deployment has completed, the user should retrieve the `dockerd` client certificate.

## Status

This deployment is for demonstration purpose only. Please do NOT consider this code ready for production.

## Deployment configuration

The configuration is limited to a strict minimum. You may need to change `aws-k8s-dockerd-ts` to match your Pulumi project name.

```yaml
config:
  aws:region: ap-southeast-2
  aws-k8s-dockerd-ts:serviceName: k8s-dockerd
  aws-k8s-dockerd-ts:vpcNetworkRange: 10.100.0.0/16
  aws-k8s-dockerd-ts:vpcSubnetsNetmask: 255.255.240.0
```

## Docker setup (client)

First, retrieve and store your `kubeconfig`

```bash
pulumi stack output kubeconfig --show-secrets  > kubeconfig
```

List the pod that runs the Docker daemon

```bash
export POD_NAME=$(KUBECONFIG=kubeconfig kubectl get pods -n dockerd-service -o=jsonpath='{.items[0].metadata.name}')
```

Retrieve the Docker client certificates and store them in their default location.

Please be cautious not to delete existing certificates. If an existing client certificate exists, then store the `.pem` files in a separate location.

```bash
# Make sure you don't overwrite an existing certificate in $HOME/.docker/
KUBECONFIG=kubeconfig kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/key.pem > $HOME/.docker/key.pem
KUBECONFIG=kubeconfig kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/ca.pem > $HOME/.docker/ca.pem
KUBECONFIG=kubeconfig kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/cert.pem > $HOME/.docker/cert.pem
```

Alternatively, store your docker client cerificate locally.

```bash
mkdir certs

KUBECONFIG=kubeconfig kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/key.pem > certs/key.pem
KUBECONFIG=kubeconfig kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/ca.pem > certs/ca.pem
KUBECONFIG=kubeconfig kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/cert.pem > certs/cert.pem
```

Validate everything is working as expected.

```bash
export DOCKER_HOST=$(pulumi stack output DOCKER_HOST)
docker image ls
docker image pull docker.io/busybox
docker image ls
```

If you have stored your Docker client certificate outside of the default location (`~/.docker/`).

```bash
export DOCKER_HOST=$(pulumi stack output DOCKER_HOST)
docker --tlscacert=certs/ca.pem  --tlskey=certs/key.pem --tlscert=certs/cert.pem image ls
docker --tlscacert=certs/ca.pem  --tlskey=certs/key.pem --tlscert=certs/cert.pem image pull docker.io/busybox
docker --tlscacert=certs/ca.pem  --tlskey=certs/key.pem --tlscert=certs/cert.pem image ls
```

### Shell script

Please proceed with caution. This is not heavily tested.

```bash
#!/bin/bash

pulumi stack output kubeconfig --show-secrets  > kubeconfig
export KUBECONFIG=kubeconfig
export DOCKER_HOST=$(pulumi stack output DOCKER_HOST)

mkdir $HOME/.docker

if [ -e "$HOME/.docker/key.pem" -o -e "$HOME/.docker/key.pem" -o -e "$HOME/.docker/key.pem" ]; then
  # get the certs
  mkdir certs
  KUBECONFIG=kubeconfig kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/key.pem > certs/key.pem
  KUBECONFIG=kubeconfig kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/ca.pem > certs/key.pem
  KUBECONFIG=kubeconfig kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/cert.pem > certs/key.pem

  # run smoke test
  docker --tlscacert=certs/ca.pem  --tlskey=certs/key.pem --tlscert=certs/cert.pem image ls
  docker --tlscacert=certs/ca.pem  --tlskey=certs/key.pem --tlscert=certs/cert.pem image pull docker.io/busybox
  docker --tlscacert=certs/ca.pem  --tlskey=certs/key.pem --tlscert=certs/cert.pem image ls
else
  # get the certs
  kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/key.pem > $HOME/.docker/key.pem
  kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/ca.pem > $HOME/.docker/key.pem
  kubectl exec -n dockerd-service $POD_NAME --container "busybox" -- cat /certs/cert.pem > $HOME/.docker/key.pem

  # run smoke test
  docker image ls
  docker image pull docker.io/busybox
  docker image ls
fi

```
