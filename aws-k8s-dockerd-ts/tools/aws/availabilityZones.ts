import * as aws from "@pulumi/aws";

type AvailabilityZonesOptions = (az: AvailabilityZones) => void

export class AvailabilityZones {

    public AvailabilityZonesNames: string[] = [];

    constructor(...options: AvailabilityZonesOptions[]) {
        for (const option of options) {
            option(this)
        }
    }

    public static async WithState(state: string): Promise<AvailabilityZonesOptions> {
        const data = await aws.getAvailabilityZones({ state: state,  });
        return (az: AvailabilityZones): void => {
            az.AvailabilityZonesNames = data.names;
        }
    }
}
