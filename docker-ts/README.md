# Configuring a Docker provider

This application demonstrates how to use Pulumi to configure a Docker provider and build an image using the configured provider.

This app also serves as a demo for our engineering team to ensure the Docker provider works as expected.

This Pulumi app plays well with [aws-k8s-dockerd-ts/](../aws-k8s-dockerd-ts/)

## Status

This deployment is for demonstration purpose only. Please do NOT consider this code ready for production.

## Provider setup (client)

- `configMode`: Use `auto` for automatic configuration, use `custom` and fill the other properties.
- `dockerHost`: The docker host to use. If emtpy withh default to `$DOCKER_HOST`
- `certPath`: Path where to find the TLS material (ca.pem, cert.pem, key.pem)
- `caFile`: Path to access the Certficate Authority (CA) PEM file
- `certFile`: Path to access the Docker client certificate
- `keyFile`: Path to the client private key
- `context`: Path from which the container image is going to be built
- `dockerfilePath`: Path to the `Dockerfile`. If unset, the Docker provider expects the Dockerfile in `context`
- `imageName`: Define the container image name

The [index.ts](index.ts) has 3 examples commeted. So just uncomment to get started.
