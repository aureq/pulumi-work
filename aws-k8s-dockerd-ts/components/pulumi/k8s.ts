import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";
import { Eks } from "../aws/eks";

interface K8sArgs {
    cluster: Eks,
    region: string,
}

export class K8s extends pulumi.ComponentResource {
    private readonly name: string;
    private readonly args: K8sArgs;

    private readonly namespaceName: string;

    public readonly namespace: k8s.core.v1.Namespace;
    public readonly deployment: k8s.apps.v1.Deployment;
    public readonly service: k8s.core.v1.Service;

    constructor(name: string, args: K8sArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:resource:K8S", name, args, opts);
        this.name = name;
        this.args = args;

        this.namespaceName = "dockerd-service";

        this.namespace = this.createNamespace();
        this.deployment = this.createDeployment();
        this.service = this.createService();
    }

    private createNamespace(): k8s.core.v1.Namespace {
        return new k8s.core.v1.Namespace(`${this.name}-namespace`, {
            metadata: {
                name: this.namespaceName
            },
        }, {
            parent: this,
            provider: this.args.cluster.cluster.provider
        });
    }

    private createDeployment(): k8s.apps.v1.Deployment {

        const appLabels = { app: "proxy" };

        return new k8s.apps.v1.Deployment(`${this.name}-deployment`, {
            metadata: {
                name: `dockerd-deployment`,
                namespace: this.namespace.metadata.name
            },
            spec: {
                selector: { matchLabels: appLabels },
                replicas: 1,
                template: {
                    metadata: { labels: appLabels },
                    spec: {
                        containers: [{
                            name: "docker-in-docker",
                            image: "docker.io/docker:23.0-dind",
                            env: [{
                                name: "DOCKER_TLS_SAN",
                                value: `DNS:*.${this.args.region}.elb.amazonaws.com`,
                            }],
                            ports: [{
                                containerPort: 2376,
                                name: "dockerd"
                            }],
                            volumeMounts: [{
                                name: "dockerd-certs",
                                mountPath: "/certs/",
                                readOnly: false,
                            }],
                            resources: {
                                requests: {
                                    memory: "512Mi",
                                }
                            },
                            securityContext: {
                                privileged: true,
                            },
                            readinessProbe: {
                                periodSeconds: 1,
                                exec: {
                                    command: [
                                        "ls",
                                        "/certs/client/ca.pem"
                                    ]
                                }
                            }
                        },{
                            name: "busybox",
                            image: "docker.io/busybox:1.35-glibc",
                            args: [
                                "/bin/sleep",
                                "86400"
                            ],
                            volumeMounts: [{
                                name: "dockerd-certs",
                                mountPath: "/certs/",
                                subPath: "client",
                                readOnly: false,
                            }],
                            resources: {
                                requests: {
                                    memory: "100Mi"
                                }
                            },
                        }],
                        volumes: [{
                            name: "dockerd-certs",
                            emptyDir: {}
                        }],
                    },
                },
            },
        }, {
            parent: this.namespace,
            provider: this.args.cluster.cluster.provider
        });
    }

    private createService(): k8s.core.v1.Service {
        return new k8s.core.v1.Service(`${this.name}-service`, {
            metadata: {
                name: `codeartifact-proxy-service`,
                namespace: this.namespace.metadata.name,
                labels: this.deployment.metadata.labels,
                annotations: {
                    "service.beta.kubernetes.io/aws-load-balancer-backend-protocol": "tcp", // The backend talks over TCP
                    "service.beta.kubernetes.io/aws-load-balancer-name": "docker-service",
                }
            },
            spec: {
                type: "LoadBalancer",
                ports: [{
                    name: "dockerd",
                    port: 2376,
                    targetPort: 2376
                }],
                externalTrafficPolicy: "Local",
                selector: this.deployment.spec.template.metadata.labels
            }
        }, {
            parent: this.namespace,
            provider: this.args.cluster.cluster.provider
        });
    }
}
