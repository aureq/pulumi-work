import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { Netmask } from "netmask";

interface VpcArgs {
    cidrBlock: pulumi.Input<string>,
    subnetMask: pulumi.Input<string>,
    availabilityZones: string[],
};

interface subnetArgs {
    azName: string,
    cidrBlock: string,
};


export class Vpc extends pulumi.ComponentResource {
    private readonly name: string;
    private readonly args: VpcArgs;

    private vpcCidr: Netmask;
    private subnetCidr: Netmask;

    public readonly vpc: aws.ec2.Vpc;
    public readonly dnsServer: string;
    public readonly igw: aws.ec2.InternetGateway;
    private readonly publicRouteTable: aws.ec2.RouteTable;
    public readonly publicSubnets: pulumi.Output<aws.ec2.Subnet[]>;
    public readonly privateSubnets: pulumi.Output<aws.ec2.Subnet[]>;

    // public readonly securityGroups: pulumi.Output<aws.ec2.SecurityGroup[]>;
    // public readonly securityGroupIds: pulumi.Output<string>[];

    /**
     * This is the class constructor. This method class all other private methods to correctly construct our Vpc
     *
     * @param name The base name for the resources created by this class
     * @param args The resource properties
     * @param opts Additional Pulumi CustomResourceOptions
     */
    constructor(name: string, args: VpcArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:resource:VPC", name, args, opts);
        this.name = name;
        this.args = args;

        this.vpcCidr = new Netmask(this.args.cidrBlock.toString());
        this.subnetCidr = new Netmask(this.vpcCidr.base+'/'+this.args.subnetMask);

        this.vpc = this.createVpc();
        this.dnsServer = this.getDnsServer();
        this.igw = this.createIgw();
        this.publicRouteTable = this.createPublicRouteTable();

        /**
         * prepare our subnet settings
         */
        let _publicSubnetsSettings: subnetArgs[] = [];
        let _privateSubnetsSettings: subnetArgs[] = [];
        for (let x = 0; x < this.args.availabilityZones.length; x++) {
           let azName = this.args.availabilityZones[x];

            _publicSubnetsSettings.push({
                azName: azName,
                cidrBlock: this.subnetCidr.base+'/'+this.subnetCidr.bitmask,
            });
            this.subnetCidr = this.subnetCidr.next();

            _privateSubnetsSettings.push({
                azName: azName,
                cidrBlock: this.subnetCidr.base+'/'+this.subnetCidr.bitmask,
            });
           this.subnetCidr = this.subnetCidr.next();
        }

        this.publicSubnets = this.createPublicSubnets(_publicSubnetsSettings);
        this.privateSubnets = this.createPrivateSubnets(_privateSubnetsSettings);


    }

    /**
     * Create a new AWS VPC
     *
     * @returns returns our Vpc object
     */
    private createVpc(): aws.ec2.Vpc {
        let vpcName = this.name + '-vpc'
        return new aws.ec2.Vpc( vpcName, {
            cidrBlock: this.args.cidrBlock,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            tags: {
                'Name': vpcName,
                'Project': this.name,
            }
        }, { parent: this });
    }

    /**
     * The function returns the DNS server for the current VPC.
     *
     * @returns a string containing the VPC local DNS server. This is needed for the Wireguard client.
     */
    private getDnsServer(): string {
        let x = new Netmask(this.args.cidrBlock.toString());
        return new Netmask(x.first).next().first.toString();
    }

    /**
     * This function creates an internet gateway so the resulting will have the ability to access the internet.
     *
     * @returns returns this InternetGateway object
     */
    private createIgw(): aws.ec2.InternetGateway {
        let igwName = this.name + '-igw';
        return new aws.ec2.InternetGateway(igwName, {
            vpcId: this.vpc.id,
            tags: {
                'Name': igwName,
                'Project': this.name,
            }
        },{ parent: this.vpc });
    }

    /**
     * This function create a new route table to allow the traffic to flow in and out of our Vpc.
     *
     * @returns returns the RouteTable object
     */
    private createPublicRouteTable(): aws.ec2.RouteTable {
        let rtName = this.name + '-rt';
        return new aws.ec2.RouteTable(rtName, {
            vpcId: this.vpc.id,
            routes: [
                {
                    cidrBlock: '0.0.0.0/0',
                    gatewayId: this.igw.id
                }
            ],
            tags: {
                'Name': rtName,
                'Project': this.name,
            }
        }, { parent: this.vpc });
    }

    /**
     * This function creates a subnet in each availability-zone in the selected AWS region. Then, it associates the new subnet to the route table create with `_route_table`
     *
     * @returns returns an array with 2 or more Vpc Subnets
     */
    private createPublicSubnets(subnetsSettings: subnetArgs[]): pulumi.Output<aws.ec2.Subnet[]> {

        let subnets: aws.ec2.Subnet[] = [];
        subnetsSettings.forEach(subnetSettings => {

            let vpcSubnet: aws.ec2.Subnet;
            let subnetName = this.name + '-public-subnet-' + subnetSettings.azName;
            subnets.push(
                vpcSubnet = new aws.ec2.Subnet(subnetName, {
                    vpcId: this.vpc.id,
                    cidrBlock: subnetSettings.cidrBlock,
                    assignIpv6AddressOnCreation: false,
                    mapPublicIpOnLaunch: true,
                    availabilityZone: subnetSettings.azName,
                    tags: {
                        'Name': subnetName,
                        'Project': this.name,
                    }
                }, { parent: this.vpc })
            );

            new aws.ec2.RouteTableAssociation(this.name+'-public-rt-assoc-'+subnetSettings.azName, {
                routeTableId: this.publicRouteTable.id,
                subnetId: vpcSubnet.id
            }, { parent: this.publicRouteTable });

        });

        return pulumi.output(subnets);
    }

    /**
     * This function creates a subnet in each availability-zone in the selected AWS region. Then, it associates the new subnet to the route table create with `_route_table`
     *
     * @returns returns an array with 2 or more Vpc Subnets
     */
    private createPrivateSubnets(subnetsSettings: subnetArgs[]): pulumi.Output<aws.ec2.Subnet[]> {

        let subnets: aws.ec2.Subnet[] = [];
        subnetsSettings.forEach(subnetSettings => {

            let subnetName = this.name + '-private-subnet-' + subnetSettings.azName;
            subnets.push(
                new aws.ec2.Subnet(subnetName, {
                    vpcId: this.vpc.id,
                    cidrBlock: subnetSettings.cidrBlock,
                    assignIpv6AddressOnCreation: false,
                    mapPublicIpOnLaunch: true,
                    availabilityZone: subnetSettings.azName,
                    tags: {
                        'Name': subnetName,
                        'Project': this.name,
                    }
                }, { parent: this.vpc })
            );

        });

        return pulumi.output(subnets);
    }

    public publicSubnetIds(): pulumi.Output<pulumi.Output<string>[]> {
        return pulumi.all([this.publicSubnets]).apply(([_publicSubnets]) => {
            return _publicSubnets.map(x => x.id);
        });
    }

    // /**
    //  * Ths function creates the necessary security groups related to our Vpc
    //  *
    //  * @returns Returns 1) an array of security group objects, 2) an array of security group Ids.
    //  */
    // private createSecurityGroups(): [pulumi.Output<aws.ec2.SecurityGroup[]>, pulumi.Output<string>[]] {

    //     let securityGroups: aws.ec2.SecurityGroup[] = [];
    //     let securityGroupIds: pulumi.Output<string>[] = [];
    //     let _sg: aws.ec2.SecurityGroup;

    //     let sg_name = this.name + '-public-sg-ssh';
    //     _sg = new aws.ec2.SecurityGroup(sg_name, {
    //         vpcId: this.vpc.id,
    //         description: 'Allow ssh client access',
    //         tags: {
    //             'Name': sg_name,
    //             'Project': this.name,
    //         },
    //         ingress: [{
    //             cidrBlocks: [ '0.0.0.0/0'],
    //             fromPort: 22,
    //             toPort: 22,
    //             protocol: 'tcp',
    //             description: 'Allow ssh access'
    //         }],
    //         egress: [{
    //             cidrBlocks: ['0.0.0.0/0'],
    //             fromPort: 0,
    //             toPort: 0,
    //             protocol: '-1'
    //         }],
    //     }, { parent: this.vpc, deleteBeforeReplace: true });

    //     securityGroups.push(_sg);
    //     securityGroupIds.push(_sg.id);

    //     return [pulumi.output(securityGroups), securityGroupIds];
    // }

}
