import * as cdk from '@aws-cdk/core';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions'
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as sm from "@aws-cdk/aws-secretsmanager";
import { PipelineProject } from '@aws-cdk/aws-codebuild';
import { Construct } from '@aws-cdk/core';
import { stringLike } from '@aws-cdk/assert';

export interface EnvProps {
    prod: boolean;
}

export class PipelineAPI extends cdk.Stack {
    // Creates the Pipeline for the meal planner API. The pipeline provisions infrastructure with SAM.
    constructor(scope: cdk.Construct, id: string, props?: EnvProps) {
        super(scope, id);

        // Retrieve GitHub access token
        const oauthTokenGitHub = cdk.SecretValue.secretsManager('meal-planner-github-oauth-token');
        const sourceOutput = new codepipeline.Artifact();

        // STAGE ACTIONS

        // Source action
        const sourceAction = new codepipeline_actions.GitHubSourceAction({
            actionName: "Source_GitHub",
            owner: "Third Party",
            repo: "AdrianP873/meal-planner-platform",
            branch: "staging",
            oauthToken: oauthTokenGitHub,
            output: sourceOutput
        });

        // Build Project
        const infraBuildProject = new PipelineProject(this, "InfraBuild", {
            projectName: "MealPlanner_API",
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                env: {
                  'exported-variables': [
                    'MY_VAR',
                  ],
                },
                phases: {
                  build: {
                    commands: 'export MY_VAR="some value"',
                  },
                },
              }),
            })

        // Build action
        const infraBuildAction = new codepipeline_actions.CodeBuildAction({
            actionName: "Build_Infra",
            project: infraBuildProject,
            input: sourceOutput,
            outputs: [new codepipeline.Artifact()],
        });
            // buildspec
            // env vars
            // env
            // proj name
            // role
            // description


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