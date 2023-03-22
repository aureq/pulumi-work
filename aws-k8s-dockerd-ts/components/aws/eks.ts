import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import { Vpc } from "./vpc";

interface EksArgs {
    vpc: Vpc,
    awsRegion: pulumi.Input<string>,
};


export class Eks extends pulumi.ComponentResource {
    private readonly name: string;
    private readonly args: EksArgs;

    public readonly clusterRole: aws.iam.Role;
    public readonly cluster: eks.Cluster;
    public readonly clusterManagedNodeGroup: aws.eks.NodeGroup;

    constructor(name: string, args: EksArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:resource:EKS", name, args, opts);
        this.name = name;
        this.args = args;

        this.clusterRole = this.createClusterRole();
        [this.cluster, this.clusterManagedNodeGroup] = this.createCluster();
    }

    private createClusterRole(): aws.iam.Role {
        let clusterRole = new aws.iam.Role('cluster-role', {
            assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
                Service: "ec2.amazonaws.com",
            }),
        }, { parent: this });

        let x = 0;
        for (const policyArn of [
            "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
            "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
            "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",]) {
            new aws.iam.RolePolicyAttachment(`${this.name}-role-policy-${x}`, {
                policyArn: policyArn,
                role: clusterRole
            }, { parent: clusterRole });
            x++;
        }

        return clusterRole;
    }

    private createCluster(): [eks.Cluster, aws.eks.NodeGroup] {
        let cluster =  new eks.Cluster(`cluster`, {
            vpcId: this.args.vpc.vpc.id,
            subnetIds: this.args.vpc.publicSubnetIds(),
            createOidcProvider: true,
            storageClasses: "gp2",
            deployDashboard: false,
            instanceRole: this.clusterRole,
            skipDefaultNodeGroup: true,
            tags: {
                'Name': `cluster`,
                'Project': this.name,
            },
        }, { parent: this.args.vpc, dependsOn: [ this.clusterRole ] });

        let managedNodeGroup = eks.createManagedNodeGroup('managed-node-group', {
            cluster: cluster.core,
            nodeRoleArn: this.clusterRole.arn,
            instanceTypes: ['t3.medium'],
            subnetIds: this.args.vpc.publicSubnetIds(),
            scalingConfig: {
                minSize: 1,
                maxSize: 5,
                desiredSize: 1,
            },
            labels: {
                "ondemand": "true"
            },
            tags: {
                'Name': `${this.name}-cluster-ng`,
            },
        },  cluster );

        return [cluster, managedNodeGroup];
    }
};
