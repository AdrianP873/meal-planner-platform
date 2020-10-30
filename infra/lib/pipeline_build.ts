import * as cdk from '@aws-cdk/core';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions'
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as sm from "@aws-cdk/aws-secretsmanager";
import * as codestarconnections from '@aws-cdk/aws-codestarconnections';


export interface EnvProps {
    prod: boolean;
}

export class PipelineAPI extends cdk.Stack {
    // Creates the Pipeline for the meal planner API. The pipeline provisions infrastructure with SAM.
    constructor(scope: cdk.Construct, id: string, props?: EnvProps) {
        super(scope, id);

        const sourceOutput = new codepipeline.Artifact();
        const packageSamOutput = new codepipeline.Artifact('package')
        
        const codestarConnection = new codestarconnections.CfnConnection(this, "githubConnection", {
            connectionName: "meal-planner-github-connector",
            providerType: "GitHub"
        });

        const env = this.node.tryGetContext("env");
        if (env == "staging") {
            var branch = "staging"
        } else {
            var branch = "main"
        }
        // STAGE ACTIONS

        // Source action        
        const sourceAction = new codepipeline_actions.BitBucketSourceAction({
            actionName: "Source_GitHub",
            owner: "AdrianP873",
            repo: "meal-planner-platform",
            output: sourceOutput,
            connectionArn: codestarConnection.attrConnectionArn,
            branch: branch
        })
     
        // Build Project
        const infraBuildProject = new codebuild.PipelineProject(this, this.node.tryGetContext("env") + '-meal-planner-api-pipeline', {
            projectName: this.node.tryGetContext("env") + "-meal-planner-api-project",
            buildSpec: codebuild.BuildSpec.fromSourceFilename("buildspec.yml"),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_4_0
            }
            });

        // Build actions
        // Linting and SAM packaging
        
        const stylingAction = new codepipeline_actions.CodeBuildAction({
            actionName: env + "_Package_SAM",
            project: infraBuildProject,
            input: sourceOutput,
            outputs: [packageSamOutput]
        });

        const cdkBuildOutput = new codepipeline.ArtifactPath(packageSamOutput, "packaged-template.yaml")

        const deploySamChangeSetAction = new codepipeline_actions.CloudFormationCreateReplaceChangeSetAction({
            actionName: env + "_Deploy_SAM_Changeset",
            stackName: env + "-meal-planner-api",
            templatePath: cdkBuildOutput,
            adminPermissions: true,
            changeSetName: env + "-meal-planner-api-changeset"
        })

        const executeSamChangeSetAction = new codepipeline_actions.CloudFormationExecuteChangeSetAction({
            actionName: env + "_Execute_SAM_Changeset",
            changeSetName: env + "-meal-planner-api-changeset",
            stackName: "-meal-planner-api",

        })

        // Build the full pipeline
        const pipeline = new codepipeline.Pipeline(this, "InfraPipeline", {
            pipelineName: this.node.tryGetContext("env") + "_InfraPipeline",
            crossAccountKeys: false
        });

        pipeline.addStage({
            stageName: 'Source',
            actions: [sourceAction]
        })

        pipeline.addStage({
            stageName: "Styling",
            actions: [stylingAction]
        })

        pipeline.addStage({
            stageName: "DeploySamChangeSet",
            actions: [deploySamChangeSetAction]
        })

        pipeline.addStage({
            stageName: "ExecuteSamChangeSet",
            actions: [executeSamChangeSetAction]
        })
    }
}