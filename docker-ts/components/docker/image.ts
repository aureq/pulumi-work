import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import * as fs from 'fs';

/**
 * Defines how the Docker provider should be configured
 *
 * - `auto` Let the provider use all it's internal stuff
 * - `custom` Create provider based on submitted values
 */
export enum ConfigMode {
    Auto,
    Custom
};

interface ImageArgs {
    /**
     * Use `auto` for automatic configuration, use `custom` and fill the other properties.
     */
    configMode: ConfigMode,
    /**
     * The docker host to use. If emtpy withh default to `$DOCKER_HOST`
     */
    dockerHost?: string,
    /**
     * Path where to find the TLS material (ca.pem, cert.pem, key.pem)
     */
    certPath?: string,
    /**
     * Path to access the Certficate Authority PEM file
     */
    caFile?: string,
    /**
     * Path to access the Docker client certificate
     */
    certFile?: string,
    /**
     * Path to the client private key
     */
    keyFile?: string,
    /**
     * Path from which the container image is going to be built
     */
    context: string,
    /**
     * Path to the `Dockerfile`. If unset, the Docker provider expects the Dockerfile in `context`
     */
    dockerfilePath?: string,
    /**
     * Define the container image name
     */
    imageName: string,
};


export class Image extends pulumi.ComponentResource {
    private readonly name: string;
    private readonly args: ImageArgs;

    private readonly dockerProvider: docker.Provider;
    private readonly dockerImage: docker.Image;

    constructor(name: string, args: ImageArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:resource:IMAGE", name, args, opts);
        this.name = name;
        this.args = args;

        this.dockerProvider = this.createDockerProvider();
        this.dockerImage = this.createDockerImage();

    }

    private createDockerProvider(): docker.Provider {

        if (this.args.configMode === ConfigMode.Auto) {
            pulumi.log.info("Letting the Docker provider configure itself. It will use your `DOCKER_HOST` environment variable.");
            return new docker.Provider(`${this.name}-docker`, {}, { parent: this });
        }

        const providerArgs: docker.ProviderArgs = {};

        if (this.args.configMode === ConfigMode.Custom) {
            if (this.args.dockerHost) {
                providerArgs.host = this.args.dockerHost;
            }

            /**
             * Are we communicating with a secure Dockerd service?
             */
            if (this.args.dockerHost && this.args.dockerHost.indexOf(":2376") > 0) {
                pulumi.log.info("TLS detected, evaluating TLS related settings.");

                if (this.args.certPath && this.args.certPath.length > 0) {
                    providerArgs.certPath = this.args.certPath;
                    return new docker.Provider(`${this.name}-docker`, providerArgs, { parent: this });
                }

                if (!this.args.caFile || this.args.caFile.length < 1) {
                    throw new Error("Invalid `caFile` value");
                }

                if (!this.args.certFile || this.args.certFile.length < 1) {
                    throw new Error("Invalid `certFile` value");
                }

                if (!this.args.keyFile || this.args.keyFile.length < 1) {
                    throw new Error("Invalid `keyFile` value");
                }

                providerArgs.caMaterial = fs.readFileSync(this.args.caFile).toString();
                providerArgs.certMaterial = fs.readFileSync(this.args.certFile).toString();
                providerArgs.keyMaterial = fs.readFileSync(this.args.keyFile).toString();

                return new docker.Provider(`${this.name}-docker`, providerArgs, { parent: this });
            }
        }

        pulumi.log.warn("returning a default provider");
        return new docker.Provider(`${this.name}-docker`, {}, { parent: this });
    }

    private createDockerImage(): docker.Image {

        const args: docker.ImageArgs = {
            imageName: this.args.imageName,
            skipPush: true,
            build: {
                platform: "linux/amd64",
                builderVersion: docker.BuilderVersion.BuilderBuildKit,
                context: this.args.context,
                dockerfile: this.args.dockerfilePath,
                // cacheFrom: {
                //     // images: ["docker.io/pulumibot/demo-image:cache-base"]
                // },
            }
        }

        return new docker.Image(`${this.name}-image`, args, {
            provider: this.dockerProvider,
            parent: this.dockerProvider,
        });
    }

}
