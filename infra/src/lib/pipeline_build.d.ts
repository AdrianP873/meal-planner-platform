import * as cdk from "@aws-cdk/core";
export interface EnvProps {
    prod: boolean;
}
export declare class PipelineAPI extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: EnvProps);
}
