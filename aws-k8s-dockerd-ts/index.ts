import * as pulumi from "@pulumi/pulumi";
import { AvailabilityZones } from "./tools/aws/availabilityZones";
import { Vpc } from "./components/aws/vpc";
import { Eks } from "./components/aws/eks";
import { K8s } from "./components/pulumi/k8s";

const awsConfig = new pulumi.Config("aws");
const config = new pulumi.Config();
const serviceName = config.require('serviceName');

export = async () => {

    const Azs = new AvailabilityZones(await AvailabilityZones.WithState('available'));

    const vpcNetwork = new Vpc(serviceName, {
        cidrBlock: config.get('vpcNetworkRange') || '10.100.0.0/16',
        subnetMask: config.get('vpcSubnetsNetmask') || '255.255.240.0',
        availabilityZones: Azs.AvailabilityZonesNames,
    });

    const eksCluster = new Eks("eks-cluster", {
        vpc: vpcNetwork,
        awsRegion: awsConfig.require("region"),
    }, {
        parent: vpcNetwork
    });

    const k8s = new K8s("dockerd", {
        cluster: eksCluster,
        region: awsConfig.require("region"),
    }, {
        parent: eksCluster
    });


    return {
        "kubeconfig": pulumi.secret(eksCluster.cluster.kubeconfigJson),
        "DOCKER_HOST": pulumi.interpolate`tcp://${k8s.service.status.loadBalancer.ingress[0].hostname}:2376`,
    }
};