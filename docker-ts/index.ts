import * as pulumi from "@pulumi/pulumi";
import { Image, ConfigMode } from "./components/docker/image";

const config = new pulumi.Config();

export = async () => {

    // /**
    //  * This is a custom provider configuration that uses a cust cert path.
    //  */
    // const containerImageCertPath = new Image("container-image-cert-path", {
    //     configMode: ConfigMode.Custom,
    //     dockerHost: "tcp://ad368ea73be9443c8a913889e100cf5a-1509700552.ap-southeast-2.elb.amazonaws.com:2376",
    //     certPath: "certs/",
    //     context: "docker/assets",
    //     dockerfilePath: "docker/Dockerfile",
    //     imageName: "aureq/custom-host-certpath:latest",
    // });

    // /**
    //  * This method uses specific PEM files
    //  */
    // const containerImageTLSFiles = new Image("container-image-tls-files", {
    //     configMode: ConfigMode.Custom,
    //     dockerHost: "tcp://ad368ea73be9443c8a913889e100cf5a-1509700552.ap-southeast-2.elb.amazonaws.com:2376",
    //     caFile: "certs/ca.pem",
    //     certFile: "certs/cert.pem",
    //     keyFile: "certs/key.pem",
    //     context: "docker/assets",
    //     dockerfilePath: "docker/Dockerfile",
    //     imageName: "aureq/custom-host-tls-files:latest",
    // });

    // /**
    //  * Let the Docker provider confige itsel using the DOCKER_HOST environment variable
    //  */
    // const containerImageAuto = new Image("container-image-auto", {
    //     configMode: ConfigMode.Auto,
    //     context: "docker/assets",
    //     dockerfilePath: "docker/Dockerfile",
    //     imageName: "aureq/auto:latest",
    // });

};
