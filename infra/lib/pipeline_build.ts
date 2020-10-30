import * as cdk from '@aws-cdk/core';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions'
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as sm from "@aws-cdk/aws-secretsmanager";
import { BuildSpec, LinuxBuildImage, PipelineProject } from '@aws-cdk/aws-codebuild';
import * as codestarconnections from '@aws-cdk/aws-codestarconnections';
import { CfnConnection } from '@aws-cdk/aws-codestarconnections';
import { profileEnd } from 'console';


export interface EnvProps {
    prod: boolean;
}

export class PipelineAPI extends cdk.Stack {
    // Creates the Pipeline for the meal planner API. The pipeline provisions infrastructure with SAM.
    constructor(scope: cdk.Construct, id: string, props?: EnvProps) {
        super(scope, id);

        const sourceOutput = new codepipeline.Artifact();
        const codestarConnection = new CfnConnection(this, "githubConnection", {
            connectionName: "meal-planner-github-connector",
            providerType: "GitHub"
        });

        // STAGE ACTIONS

        // Source action        
        const sourceAction = new codepipeline_actions.BitBucketSourceAction({
            actionName: "Source_GitHub",
            owner: "AdrianP873",
            repo: "meal-planner-platform",
            output: sourceOutput,
            connectionArn: codestarConnection.attrConnectionArn,
            branch: this.node.tryGetContext("env")
        })
     
        // Build Project
        const infraBuildProject = new PipelineProject(this, this.node.tryGetContext("env") + '-meal-planner-api-pipeline', {
            projectName: this.node.tryGetContext("env") + "-meal-planner-api-project",
            buildSpec: BuildSpec.fromSourceFilename("buildspec.yml"),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_4_0
            }
          
            });

        // Build action
        const infraBuildAction = new codepipeline_actions.CodeBuildAction({
            actionName: "Build_Infra",
            project: infraBuildProject,
            input: sourceOutput,
            outputs: [new codepipeline.Artifact()],
        });

        // Build the full pipeline
        const pipeline = new codepipeline.Pipeline(this, "InfraPipeline", {
            pipelineName: "InfraPipeline",
            crossAccountKeys: false
        });

        pipeline.addStage({
            stageName: 'Source',
            actions: [sourceAction]
        })

        pipeline.addStage({
            stageName: "InfraBuild",
            actions: [infraBuildAction]
        })


    }
}