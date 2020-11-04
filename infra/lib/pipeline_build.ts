import * as cdk from '@aws-cdk/core';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions'
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as sm from "@aws-cdk/aws-secretsmanager";
import * as codestarconnections from '@aws-cdk/aws-codestarconnections';
import { S3DeployAction } from '@aws-cdk/aws-codepipeline-actions';
import * as s3 from '@aws-cdk/aws-s3';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import { AccountPrincipal, AnyPrincipal, CompositePrincipal, Effect, PolicyDocument, PolicyStatement, Role, RoleProps, ServicePrincipal } from '@aws-cdk/aws-iam';
import { StackPathInspector } from '@aws-cdk/assert';
import { StackProps } from '@aws-cdk/core';
import { ImagePullPrincipalType } from '@aws-cdk/aws-codebuild';



export interface EnvProps {
    prod: boolean;
}

export class PipelineAPI extends cdk.Stack {
    // Creates the Pipeline for the meal planner API. The pipeline provisions infrastructure with SAM.
    constructor(scope: cdk.Construct, id: string, props?: EnvProps) {
        super(scope, id);

        
        // Service roles
        const codeBuildServiceRole = new Role(this, 'mealPlannerCodeBuildServiceRole', {
            assumedBy: new CompositePrincipal(
                new ServicePrincipal('codepipeline.amazonaws.com'),
                new ServicePrincipal('codebuild.amazonaws.com'),
                new AnyPrincipal()
            ),
            description: 'Service role for CodeBuild',
        });

        codeBuildServiceRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                resources: ['*'],
                actions: [
                    "s3:*",                    
                    "logs:*"
                ]
            })
        )
  
        const cfnServiceRole = new Role(this, 'mealPlannerCfnServiceRole', {
            assumedBy: new ServicePrincipal('cloudformation.amazonaws.com'),
            description: 'Service role for CloudFormation'
        })

        cfnServiceRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                resources: ['*'],
                actions: [
                    "apigateway:*",
                    "cloudformation:*",
                    "cloudwatch:*",
                    "dynamodb:*",
                    "events:*",
                    "iam:*",
                    "lambda:*",
                    "s3:*"                    
                ]
            })
        )

        const codePipelineServiceRole = new Role(this, 'mealPlannerCodePipelineServiceRole', {
            assumedBy: new ServicePrincipal('codepipeline.amazonaws.com'),
            description: 'Service role for CodePipeline'
        })
    
        codePipelineServiceRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                resources: ['*'],
                actions: [
                    "iam:PassRole",
                    "apigateway:*",
                    "cloudformation:*",
                    "cloudwatch:*",
                    "codebuild:*",
                    "dynamodb:*",
                    "s3:*"
                ]
            })
        )

            //CFn Service Role
            // Pipeline serviceRole
            // CodeBuild Service role

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
            },
            role: codeBuildServiceRole
            });

        // Build actions
        // Linting and SAM packaging
        const stylingAction = new codepipeline_actions.CodeBuildAction({
            actionName: env + "_Package_SAM",
            project: infraBuildProject,
            input: sourceOutput,
            outputs: [packageSamOutput],
            role: codeBuildServiceRole
        });

        const cdkBuildOutput = new codepipeline.ArtifactPath(packageSamOutput, "packaged-template.yaml")
        
        const deploySamChangeSetAction = new codepipeline_actions.CloudFormationCreateReplaceChangeSetAction({
            actionName: env + "_Deploy_SAM_Changeset",
            stackName: env + "-meal-planner-api",
            templatePath: cdkBuildOutput,
            adminPermissions: true,
            changeSetName: env + "-meal-planner-api-changeset",
            deploymentRole: cfnServiceRole
        })

        const myBucket = new s3.Bucket(this, 'artifactBucket', {versioned: false})

        // Build the full pipeline
        const pipeline = new codepipeline.Pipeline(this, "InfraPipeline", {
            pipelineName: this.node.tryGetContext("env") + "_InfraPipeline",
            crossAccountKeys: false,
            artifactBucket: myBucket,
            role: codePipelineServiceRole
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
    }
}