import { Stack, StackProps } from 'aws-cdk-lib'
import { Vpc } from 'aws-cdk-lib/aws-ec2'
import { Cluster, ContainerImage } from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import { ScalableTarget, ServiceNamespace } from 'aws-cdk-lib/aws-applicationautoscaling'
import { Duration } from 'aws-cdk-lib'
import { Metric } from 'aws-cdk-lib/aws-cloudwatch'
//import { RestApi, HttpIntegration, Integration, IntegrationType } from 'aws-cdk-lib/aws-apigateway'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
// import { HttpAlbIntegration } from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpApi } from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpAlbIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';

import { Construct } from 'constructs'

import * as fs from 'fs'
import { parse } from 'yaml'
/*
type Resources = { [ path: string]: IResource }

interface IResource {

  childResource: Resources
  methods?: IMethod[]
}


interface IMethod {

  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
}

function callback([key, value]: [string, IResource], idx: number) {

  console.log(`${idx}: ${key}`, value)

  if (value) {}
    Object.entries(value.childResource).forEach(callback)
  }
}
*/
declare const cpuUtilization: Metric;

export class EcsFargateStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {

    super(scope, id, props);

    // const file = fs.readFileSync('/Users/hys006/CSIRO-ALA/Deployment/esc-container-demo/namematching-openapi.yaml', 'utf8')


    const vpc = new Vpc(this, 'VPC', {
      maxAzs: 3 // Default is all AZs in region
    });

    const cluster = new Cluster(this, 'Cluster', {
      vpc: vpc
    });

    // Create a load-balanced Fargate service and make it public
    // const service = new ApplicationLoadBalancedFargateService(this, 'FargateService', {
    const service = new ecsPatterns.NetworkLoadBalancedFargateService(this, 'FargateService', {
      cluster: cluster,
      cpu: 512,
      desiredCount: 1,
      taskImageOptions: { 
        image: ContainerImage.fromRegistry("djtfmartin/ala-namematching-service:v1.8-v20210811-3"),
        containerPort: 9179
      },
      memoryLimitMiB: 2048, 
      publicLoadBalancer: true,
      listenerPort: 9179
    })

    const scalingTarget = new ScalableTarget(this, 'ScalableTarget', {
      serviceNamespace: ServiceNamespace.ECS,
      resourceId: `service/${service.cluster.clusterName}/${service.service.serviceName}`,
      scalableDimension: 'ecs:service:DesiredCount',
      minCapacity: 1,
      maxCapacity: 10
    })

    scalingTarget.scaleOnMetric('ScaleToCPU', {
      metric: service.service.metricCpuUtilization(),
      scalingSteps: [
        { upper: 10, change: -1 },
        { lower: 50, change: +1 },
        { lower: 70, change: +3 }
      ],
      cooldown: Duration.minutes(1),
    })


    // const api = new apigateway.SpecRestApi(this, 'NameMatchingService Rest API', {
    //   apiDefinition: apigateway.ApiDefinition.fromAsset('../namematching-openapi.yaml'),
    //   failOnWarnings: false
    // })

    const vpcLink = new apigateway.VpcLink(this, 'Link', {
      targets: [ service.loadBalancer ]
    })

    const api = new apigateway.RestApi(this, 'NameMatchingService Rest API')
/*
    const file = fs.readFileSync('../namematching-openapi.yaml', 'utf8')

    const openApiSpec = parse(file)

    console.log(openApiSpec)

    const rootResource: IResource = { 
      childResource: {}
    }

    Object.entries(openApiSpec.paths).forEach(([ key, value ], idx) => {
      
      const resource = key.split('/')
        .filter((resource) => !!resource)
        .reduce((childResource: Resources, resource: string, idx: number, array: string[]) => {

          if (!childResource.hasOwnProperty(resource)) {

            childResource[resource] = { 
              childResource: {} 
            }
          }

          return childResource[resource].childResource

        }, rootResource.childResource)
    });
    
    // console.log(rootResource.childResource)

    Object.entries(rootResource.childResource).reduce((childResource: Resources, [key, value]: [string, IResource], idx: number) => {

      console.log(`${idx}: ${key}`, value)

      return value.childResource

    }, rootResource.childResource)

    // apiSpec.childResource.forEach(([ path, resource ]: [ string, Resources]) => )

    // Object.entries(rootResource.childResource).reduce((childResource: Resources, [ path, resource ]: [ string, Resources], idx: number) => { 

    //   console.log(`${idx}: ${path}`)

    //   return resource.childResource
    // })


    Object.entries(rootResource.childResource).forEach(callback);




    // Object.entries(rootResource.childResource).forEach((_) => {});
*/
    // api.root.addMethod('GET', new HttpIntegration(`http://${service.loadBalancer.loadBalancerDnsName}:9180/`))

    const integration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink: vpcLink,
      },
    })

    const apiPath = api.root.addResource('api')

    apiPath.addResource('autocomplete').addMethod('GET', integration, {
      requestParameters: {
        'method.request.querystring.q': true,
        'method.request.querystring.includeSynonyms': false,
        'method.request.querystring.max': false
      }
    })

    apiPath.addResource('search').addMethod('GET', integration, {
      requestParameters: {
        'method.request.querystring.q': true
      }
    })

    // apiPath.addResource('autocomplete').addMethod('GET', new apigateway.HttpIntegration(`http://${service.loadBalancer.loadBalancerDnsName}:9180/api/autocomplete`), {
    //   requestParameters: {
    //     'method.request.querystring.q': true,
    //     'method.request.querystring.includeSynonyms': false,
    //     'method.request.querystring.max': false
    //   }
    // })

    // apiPath.addResource('search').addMethod('GET', new apigateway.HttpIntegration(`http://${service.loadBalancer.loadBalancerDnsName}:9180/api/search`), {
    //   requestParameters: {
    //     'method.request.querystring.q': true
    //   }
    // })

    console.log(`load balance: http://${service.loadBalancer.loadBalancerDnsName}:9180`)

    // proxy.addMethod('ANY', new HttpIntegration(`http://${service.loadBalancer.loadBalancerDnsName}:9180/{proxy}`))
    // proxy.addProxy({ defaultIntegration: new HttpAlbIntegration('', service.loadBalancer.listeners[0]) })
  }
}
