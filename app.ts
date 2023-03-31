import { App, Stack, StackProps } from '@aws-cdk/core'
import { SubnetType, Vpc } from '@aws-cdk/aws-ec2'
import { Cluster } from '@aws-cdk/aws-ecs'

export class NameMatchingServiceStack extends Stack {

    constructor(scope: App, id: string, props?: StackProps) {
        
        super(scope, id, props)

        const vpc = new Vpc(this, 'ECS-VPC', {
            subnetConfiguration: [
                {
                    name: 'public',
                    subnetType: SubnetType.PUBLIC
                },
                { 
                    name: 'private',
                    subnetType: SubnetType.PRIVATE_WITH_NAT
                }
            ]
        })

        const cluster = new Cluster(this, 'NameMatchingService-cluster', {

        })

    }

    
}