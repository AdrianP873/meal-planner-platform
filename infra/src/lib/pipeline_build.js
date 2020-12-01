"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineAPI = void 0;
const cdk = require("@aws-cdk/core");
const codepipeline = require("@aws-cdk/aws-codepipeline");
const codepipelineActions = require("@aws-cdk/aws-codepipeline-actions");
const codebuild = require("@aws-cdk/aws-codebuild");
const codestarconnections = require("@aws-cdk/aws-codestarconnections");
const iam = require("@aws-cdk/aws-iam");
const s3 = require("@aws-cdk/aws-s3");
class PipelineAPI extends cdk.Stack {
    // Creates the Pipeline for the meal planner API. The pipeline provisions infrastructure with SAM.
    constructor(scope, id, props) {
        super(scope, id);
        // Service roles
        const codeBuildServiceRole = new iam.Role(this, "mealPlannerCodeBuildServiceRole", {
            assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal("codepipeline.amazonaws.com"), new iam.ServicePrincipal("codebuild.amazonaws.com"), new iam.AnyPrincipal()),
            description: "Service role for CodeBuild",
        });
        codeBuildServiceRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ["*"],
            actions: ["s3:*", "logs:*", "cloudformation:*"],
        }));
        const cfnServiceRole = new iam.Role(this, "mealPlannerCfnServiceRole", {
            assumedBy: new iam.ServicePrincipal("cloudformation.amazonaws.com"),
            description: "Service role for CloudFormation",
        });
        cfnServiceRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ["*"],
            actions: [
                "apigateway:*",
                "cloudformation:*",
                "cloudwatch:*",
                "dynamodb:*",
                "events:*",
                "iam:*",
                "lambda:*",
                "s3:*",
            ],
        }));
        const codePipelineServiceRole = new iam.Role(this, "mealPlannerCodePipelineServiceRole", {
            assumedBy: new iam.ServicePrincipal("codepipeline.amazonaws.com"),
            description: "Service role for CodePipeline",
        });
        codePipelineServiceRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ["*"],
            actions: [
                "iam:PassRole",
                "apigateway:*",
                "cloudformation:*",
                "cloudwatch:*",
                "codebuild:*",
                "dynamodb:*",
                "s3:*",
            ],
        }));
        const sourceOutput = new codepipeline.Artifact();
        const packageSamOutput = new codepipeline.Artifact("package");
        const codestarConnection = new codestarconnections.CfnConnection(this, "githubConnection", {
            connectionName: "meal-planner-github-connector",
            providerType: "GitHub",
        });
        const env = this.node.tryGetContext("env");
        if (env === "staging") {
            var branch = "staging";
        }
        else {
            branch = "main";
        }
        // STAGE ACTIONS
        // Source action
        const sourceAction = new codepipelineActions.BitBucketSourceAction({
            actionName: "Source_GitHub",
            owner: "AdrianP873",
            repo: "meal-planner-platform",
            output: sourceOutput,
            connectionArn: codestarConnection.attrConnectionArn,
            branch: branch,
        });
        // Build Projects
        const pipelineInfraBuildProject = new codebuild.PipelineProject(this, this.node.tryGetContext("env") + "-meal-planner-infra-build", {
            projectName: this.node.tryGetContext("env") + "-meal-planer-api-project",
            buildSpec: codebuild.BuildSpec.fromSourceFilename("buildspec-pipeline-infra.yml"),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
            },
            role: codeBuildServiceRole,
            environmentVariables: {
                ENV: { value: this.node.tryGetContext("env") },
            },
        });
        const pipelineInfraAction = new codepipelineActions.CodeBuildAction({
            actionName: env + "pipeline_build",
            project: pipelineInfraBuildProject,
            input: sourceOutput,
            role: codeBuildServiceRole,
        });
        const samBuildProject = new codebuild.PipelineProject(this, this.node.tryGetContext("env") + "-meal-planner-api-pipeline", {
            projectName: this.node.tryGetContext("env") + "-meal-planner-api-project",
            buildSpec: codebuild.BuildSpec.fromSourceFilename("buildspec-package.yml"),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
            },
            role: codeBuildServiceRole,
        });
        // Build actions
        // Linting and SAM packaging
        const packagingAction = new codepipelineActions.CodeBuildAction({
            actionName: env + "_package_SAM",
            project: samBuildProject,
            input: sourceOutput,
            outputs: [packageSamOutput],
            role: codeBuildServiceRole,
        });
        const cdkBuildOutput = new codepipeline.ArtifactPath(packageSamOutput, "packaged-template.yaml");
        const deploySamChangeSetAction = new codepipelineActions.CloudFormationCreateReplaceChangeSetAction({
            actionName: env + "_deploy_SAM_changeset",
            stackName: env + "-meal-planner-api",
            templatePath: cdkBuildOutput,
            adminPermissions: true,
            changeSetName: env + "-meal-planner-api-changeset",
            deploymentRole: cfnServiceRole,
        });
        const myBucket = new s3.Bucket(this, "artifactBucket", {
            versioned: false,
        });
        // Build the full pipeline
        const pipeline = new codepipeline.Pipeline(this, "InfraPipeline", {
            pipelineName: this.node.tryGetContext("env") + "_infra_pipeline",
            crossAccountKeys: false,
            artifactBucket: myBucket,
            role: codePipelineServiceRole,
        });
        pipeline.addStage({
            stageName: "Source",
            actions: [sourceAction],
        });
        pipeline.addStage({
            stageName: "TestInfra",
            actions: [pipelineInfraAction],
        });
        pipeline.addStage({
            stageName: "PackageApplication",
            actions: [packagingAction],
        });
        pipeline.addStage({
            stageName: "DeploySamChangeSet",
            actions: [deploySamChangeSetAction],
        });
    }
}
exports.PipelineAPI = PipelineAPI;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZWxpbmVfYnVpbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwaXBlbGluZV9idWlsZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxQ0FBcUM7QUFDckMsMERBQTBEO0FBQzFELHlFQUF5RTtBQUN6RSxvREFBb0Q7QUFDcEQsd0VBQXdFO0FBQ3hFLHdDQUF3QztBQUN4QyxzQ0FBc0M7QUFNdEMsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEMsa0dBQWtHO0lBQ2xHLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixnQkFBZ0I7UUFDaEIsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQ3ZDLElBQUksRUFDSixpQ0FBaUMsRUFDakM7WUFDRSxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsa0JBQWtCLENBQ25DLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLDRCQUE0QixDQUFDLEVBQ3RELElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLHlCQUF5QixDQUFDLEVBQ25ELElBQUksR0FBRyxDQUFDLFlBQVksRUFBRSxDQUN2QjtZQUNELFdBQVcsRUFBRSw0QkFBNEI7U0FDMUMsQ0FDRixDQUFDO1FBRUYsb0JBQW9CLENBQUMsV0FBVyxDQUM5QixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7WUFDaEIsT0FBTyxFQUFFLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQztTQUNoRCxDQUFDLENBQ0gsQ0FBQztRQUVGLE1BQU0sY0FBYyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLEVBQUU7WUFDckUsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLDhCQUE4QixDQUFDO1lBQ25FLFdBQVcsRUFBRSxpQ0FBaUM7U0FDL0MsQ0FBQyxDQUFDO1FBRUgsY0FBYyxDQUFDLFdBQVcsQ0FDeEIsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3RCLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1lBQ2hCLE9BQU8sRUFBRTtnQkFDUCxjQUFjO2dCQUNkLGtCQUFrQjtnQkFDbEIsY0FBYztnQkFDZCxZQUFZO2dCQUNaLFVBQVU7Z0JBQ1YsT0FBTztnQkFDUCxVQUFVO2dCQUNWLE1BQU07YUFDUDtTQUNGLENBQUMsQ0FDSCxDQUFDO1FBRUYsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQzFDLElBQUksRUFDSixvQ0FBb0MsRUFDcEM7WUFDRSxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsNEJBQTRCLENBQUM7WUFDakUsV0FBVyxFQUFFLCtCQUErQjtTQUM3QyxDQUNGLENBQUM7UUFFRix1QkFBdUIsQ0FBQyxXQUFXLENBQ2pDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztZQUNoQixPQUFPLEVBQUU7Z0JBQ1AsY0FBYztnQkFDZCxjQUFjO2dCQUNkLGtCQUFrQjtnQkFDbEIsY0FBYztnQkFDZCxhQUFhO2dCQUNiLFlBQVk7Z0JBQ1osTUFBTTthQUNQO1NBQ0YsQ0FBQyxDQUNILENBQUM7UUFFRixNQUFNLFlBQVksR0FBRyxJQUFJLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNqRCxNQUFNLGdCQUFnQixHQUFHLElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUU5RCxNQUFNLGtCQUFrQixHQUFHLElBQUksbUJBQW1CLENBQUMsYUFBYSxDQUM5RCxJQUFJLEVBQ0osa0JBQWtCLEVBQ2xCO1lBQ0UsY0FBYyxFQUFFLCtCQUErQjtZQUMvQyxZQUFZLEVBQUUsUUFBUTtTQUN2QixDQUNGLENBQUM7UUFFRixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzQyxJQUFJLEdBQUcsS0FBSyxTQUFTLEVBQUU7WUFDckIsSUFBSSxNQUFNLEdBQUcsU0FBUyxDQUFDO1NBQ3hCO2FBQU07WUFDTCxNQUFNLEdBQUcsTUFBTSxDQUFDO1NBQ2pCO1FBRUQsZ0JBQWdCO1FBQ2hCLGdCQUFnQjtRQUNoQixNQUFNLFlBQVksR0FBRyxJQUFJLG1CQUFtQixDQUFDLHFCQUFxQixDQUFDO1lBQ2pFLFVBQVUsRUFBRSxlQUFlO1lBQzNCLEtBQUssRUFBRSxZQUFZO1lBQ25CLElBQUksRUFBRSx1QkFBdUI7WUFDN0IsTUFBTSxFQUFFLFlBQVk7WUFDcEIsYUFBYSxFQUFFLGtCQUFrQixDQUFDLGlCQUFpQjtZQUNuRCxNQUFNLEVBQUUsTUFBTTtTQUNmLENBQUMsQ0FBQztRQUVILGlCQUFpQjtRQUNqQixNQUFNLHlCQUF5QixHQUFHLElBQUksU0FBUyxDQUFDLGVBQWUsQ0FDN0QsSUFBSSxFQUNKLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxHQUFHLDJCQUEyQixFQUM1RDtZQUNFLFdBQVcsRUFDVCxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsR0FBRywwQkFBMEI7WUFDN0QsU0FBUyxFQUFFLFNBQVMsQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQy9DLDhCQUE4QixDQUMvQjtZQUNELFdBQVcsRUFBRTtnQkFDWCxVQUFVLEVBQUUsU0FBUyxDQUFDLGVBQWUsQ0FBQyxZQUFZO2FBQ25EO1lBQ0QsSUFBSSxFQUFFLG9CQUFvQjtZQUMxQixvQkFBb0IsRUFBRTtnQkFDcEIsR0FBRyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxFQUFFO2FBQy9DO1NBQ0YsQ0FDRixDQUFDO1FBRUYsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLG1CQUFtQixDQUFDLGVBQWUsQ0FBQztZQUNsRSxVQUFVLEVBQUUsR0FBRyxHQUFHLGdCQUFnQjtZQUNsQyxPQUFPLEVBQUUseUJBQXlCO1lBQ2xDLEtBQUssRUFBRSxZQUFZO1lBQ25CLElBQUksRUFBRSxvQkFBb0I7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsTUFBTSxlQUFlLEdBQUcsSUFBSSxTQUFTLENBQUMsZUFBZSxDQUNuRCxJQUFJLEVBQ0osSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEdBQUcsNEJBQTRCLEVBQzdEO1lBQ0UsV0FBVyxFQUNULElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxHQUFHLDJCQUEyQjtZQUM5RCxTQUFTLEVBQUUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FDL0MsdUJBQXVCLENBQ3hCO1lBQ0QsV0FBVyxFQUFFO2dCQUNYLFVBQVUsRUFBRSxTQUFTLENBQUMsZUFBZSxDQUFDLFlBQVk7YUFDbkQ7WUFDRCxJQUFJLEVBQUUsb0JBQW9CO1NBQzNCLENBQ0YsQ0FBQztRQUVGLGdCQUFnQjtRQUNoQiw0QkFBNEI7UUFDNUIsTUFBTSxlQUFlLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxlQUFlLENBQUM7WUFDOUQsVUFBVSxFQUFFLEdBQUcsR0FBRyxjQUFjO1lBQ2hDLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLEtBQUssRUFBRSxZQUFZO1lBQ25CLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixDQUFDO1lBQzNCLElBQUksRUFBRSxvQkFBb0I7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsTUFBTSxjQUFjLEdBQUcsSUFBSSxZQUFZLENBQUMsWUFBWSxDQUNsRCxnQkFBZ0IsRUFDaEIsd0JBQXdCLENBQ3pCLENBQUM7UUFFRixNQUFNLHdCQUF3QixHQUFHLElBQUksbUJBQW1CLENBQUMsMENBQTBDLENBQ2pHO1lBQ0UsVUFBVSxFQUFFLEdBQUcsR0FBRyx1QkFBdUI7WUFDekMsU0FBUyxFQUFFLEdBQUcsR0FBRyxtQkFBbUI7WUFDcEMsWUFBWSxFQUFFLGNBQWM7WUFDNUIsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0QixhQUFhLEVBQUUsR0FBRyxHQUFHLDZCQUE2QjtZQUNsRCxjQUFjLEVBQUUsY0FBYztTQUMvQixDQUNGLENBQUM7UUFFRixNQUFNLFFBQVEsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3JELFNBQVMsRUFBRSxLQUFLO1NBQ2pCLENBQUMsQ0FBQztRQUVILDBCQUEwQjtRQUMxQixNQUFNLFFBQVEsR0FBRyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUNoRSxZQUFZLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEdBQUcsaUJBQWlCO1lBQ2hFLGdCQUFnQixFQUFFLEtBQUs7WUFDdkIsY0FBYyxFQUFFLFFBQVE7WUFDeEIsSUFBSSxFQUFFLHVCQUF1QjtTQUM5QixDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsUUFBUSxDQUFDO1lBQ2hCLFNBQVMsRUFBRSxRQUFRO1lBQ25CLE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQztTQUN4QixDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsUUFBUSxDQUFDO1lBQ2hCLFNBQVMsRUFBRSxXQUFXO1lBQ3RCLE9BQU8sRUFBRSxDQUFDLG1CQUFtQixDQUFDO1NBQy9CLENBQUMsQ0FBQztRQUVILFFBQVEsQ0FBQyxRQUFRLENBQUM7WUFDaEIsU0FBUyxFQUFFLG9CQUFvQjtZQUMvQixPQUFPLEVBQUUsQ0FBQyxlQUFlLENBQUM7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUNoQixTQUFTLEVBQUUsb0JBQW9CO1lBQy9CLE9BQU8sRUFBRSxDQUFDLHdCQUF3QixDQUFDO1NBQ3BDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTdNRCxrQ0E2TUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSBcIkBhd3MtY2RrL2NvcmVcIjtcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZSBmcm9tIFwiQGF3cy1jZGsvYXdzLWNvZGVwaXBlbGluZVwiO1xuaW1wb3J0ICogYXMgY29kZXBpcGVsaW5lQWN0aW9ucyBmcm9tIFwiQGF3cy1jZGsvYXdzLWNvZGVwaXBlbGluZS1hY3Rpb25zXCI7XG5pbXBvcnQgKiBhcyBjb2RlYnVpbGQgZnJvbSBcIkBhd3MtY2RrL2F3cy1jb2RlYnVpbGRcIjtcbmltcG9ydCAqIGFzIGNvZGVzdGFyY29ubmVjdGlvbnMgZnJvbSBcIkBhd3MtY2RrL2F3cy1jb2Rlc3RhcmNvbm5lY3Rpb25zXCI7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSBcIkBhd3MtY2RrL2F3cy1pYW1cIjtcbmltcG9ydCAqIGFzIHMzIGZyb20gXCJAYXdzLWNkay9hd3MtczNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBFbnZQcm9wcyB7XG4gIHByb2Q6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBQaXBlbGluZUFQSSBleHRlbmRzIGNkay5TdGFjayB7XG4gIC8vIENyZWF0ZXMgdGhlIFBpcGVsaW5lIGZvciB0aGUgbWVhbCBwbGFubmVyIEFQSS4gVGhlIHBpcGVsaW5lIHByb3Zpc2lvbnMgaW5mcmFzdHJ1Y3R1cmUgd2l0aCBTQU0uXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IEVudlByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIFNlcnZpY2Ugcm9sZXNcbiAgICBjb25zdCBjb2RlQnVpbGRTZXJ2aWNlUm9sZSA9IG5ldyBpYW0uUm9sZShcbiAgICAgIHRoaXMsXG4gICAgICBcIm1lYWxQbGFubmVyQ29kZUJ1aWxkU2VydmljZVJvbGVcIixcbiAgICAgIHtcbiAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkNvbXBvc2l0ZVByaW5jaXBhbChcbiAgICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJjb2RlcGlwZWxpbmUuYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJjb2RlYnVpbGQuYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgICAgICBuZXcgaWFtLkFueVByaW5jaXBhbCgpXG4gICAgICAgICksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlNlcnZpY2Ugcm9sZSBmb3IgQ29kZUJ1aWxkXCIsXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvZGVCdWlsZFNlcnZpY2VSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgICAgYWN0aW9uczogW1wiczM6KlwiLCBcImxvZ3M6KlwiLCBcImNsb3VkZm9ybWF0aW9uOipcIl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBjb25zdCBjZm5TZXJ2aWNlUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIm1lYWxQbGFubmVyQ2ZuU2VydmljZVJvbGVcIiwge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJjbG91ZGZvcm1hdGlvbi5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgZGVzY3JpcHRpb246IFwiU2VydmljZSByb2xlIGZvciBDbG91ZEZvcm1hdGlvblwiLFxuICAgIH0pO1xuXG4gICAgY2ZuU2VydmljZVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJhcGlnYXRld2F5OipcIixcbiAgICAgICAgICBcImNsb3VkZm9ybWF0aW9uOipcIixcbiAgICAgICAgICBcImNsb3Vkd2F0Y2g6KlwiLFxuICAgICAgICAgIFwiZHluYW1vZGI6KlwiLFxuICAgICAgICAgIFwiZXZlbnRzOipcIixcbiAgICAgICAgICBcImlhbToqXCIsXG4gICAgICAgICAgXCJsYW1iZGE6KlwiLFxuICAgICAgICAgIFwiczM6KlwiLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgY29uc3QgY29kZVBpcGVsaW5lU2VydmljZVJvbGUgPSBuZXcgaWFtLlJvbGUoXG4gICAgICB0aGlzLFxuICAgICAgXCJtZWFsUGxhbm5lckNvZGVQaXBlbGluZVNlcnZpY2VSb2xlXCIsXG4gICAgICB7XG4gICAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiY29kZXBpcGVsaW5lLmFtYXpvbmF3cy5jb21cIiksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlNlcnZpY2Ugcm9sZSBmb3IgQ29kZVBpcGVsaW5lXCIsXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvZGVQaXBlbGluZVNlcnZpY2VSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwiaWFtOlBhc3NSb2xlXCIsXG4gICAgICAgICAgXCJhcGlnYXRld2F5OipcIixcbiAgICAgICAgICBcImNsb3VkZm9ybWF0aW9uOipcIixcbiAgICAgICAgICBcImNsb3Vkd2F0Y2g6KlwiLFxuICAgICAgICAgIFwiY29kZWJ1aWxkOipcIixcbiAgICAgICAgICBcImR5bmFtb2RiOipcIixcbiAgICAgICAgICBcInMzOipcIixcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGNvbnN0IHNvdXJjZU91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKTtcbiAgICBjb25zdCBwYWNrYWdlU2FtT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdChcInBhY2thZ2VcIik7XG5cbiAgICBjb25zdCBjb2Rlc3RhckNvbm5lY3Rpb24gPSBuZXcgY29kZXN0YXJjb25uZWN0aW9ucy5DZm5Db25uZWN0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgIFwiZ2l0aHViQ29ubmVjdGlvblwiLFxuICAgICAge1xuICAgICAgICBjb25uZWN0aW9uTmFtZTogXCJtZWFsLXBsYW5uZXItZ2l0aHViLWNvbm5lY3RvclwiLFxuICAgICAgICBwcm92aWRlclR5cGU6IFwiR2l0SHViXCIsXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGVudiA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KFwiZW52XCIpO1xuICAgIGlmIChlbnYgPT09IFwic3RhZ2luZ1wiKSB7XG4gICAgICB2YXIgYnJhbmNoID0gXCJzdGFnaW5nXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyYW5jaCA9IFwibWFpblwiO1xuICAgIH1cblxuICAgIC8vIFNUQUdFIEFDVElPTlNcbiAgICAvLyBTb3VyY2UgYWN0aW9uXG4gICAgY29uc3Qgc291cmNlQWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZUFjdGlvbnMuQml0QnVja2V0U291cmNlQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6IFwiU291cmNlX0dpdEh1YlwiLFxuICAgICAgb3duZXI6IFwiQWRyaWFuUDg3M1wiLFxuICAgICAgcmVwbzogXCJtZWFsLXBsYW5uZXItcGxhdGZvcm1cIixcbiAgICAgIG91dHB1dDogc291cmNlT3V0cHV0LFxuICAgICAgY29ubmVjdGlvbkFybjogY29kZXN0YXJDb25uZWN0aW9uLmF0dHJDb25uZWN0aW9uQXJuLFxuICAgICAgYnJhbmNoOiBicmFuY2gsXG4gICAgfSk7XG5cbiAgICAvLyBCdWlsZCBQcm9qZWN0c1xuICAgIGNvbnN0IHBpcGVsaW5lSW5mcmFCdWlsZFByb2plY3QgPSBuZXcgY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdChcbiAgICAgIHRoaXMsXG4gICAgICB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dChcImVudlwiKSArIFwiLW1lYWwtcGxhbm5lci1pbmZyYS1idWlsZFwiLFxuICAgICAge1xuICAgICAgICBwcm9qZWN0TmFtZTpcbiAgICAgICAgICB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dChcImVudlwiKSArIFwiLW1lYWwtcGxhbmVyLWFwaS1wcm9qZWN0XCIsXG4gICAgICAgIGJ1aWxkU3BlYzogY29kZWJ1aWxkLkJ1aWxkU3BlYy5mcm9tU291cmNlRmlsZW5hbWUoXG4gICAgICAgICAgXCJidWlsZHNwZWMtcGlwZWxpbmUtaW5mcmEueW1sXCJcbiAgICAgICAgKSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgICBidWlsZEltYWdlOiBjb2RlYnVpbGQuTGludXhCdWlsZEltYWdlLlNUQU5EQVJEXzRfMCxcbiAgICAgICAgfSxcbiAgICAgICAgcm9sZTogY29kZUJ1aWxkU2VydmljZVJvbGUsXG4gICAgICAgIGVudmlyb25tZW50VmFyaWFibGVzOiB7XG4gICAgICAgICAgRU5WOiB7IHZhbHVlOiB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dChcImVudlwiKSB9LFxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBwaXBlbGluZUluZnJhQWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZUFjdGlvbnMuQ29kZUJ1aWxkQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6IGVudiArIFwicGlwZWxpbmVfYnVpbGRcIixcbiAgICAgIHByb2plY3Q6IHBpcGVsaW5lSW5mcmFCdWlsZFByb2plY3QsXG4gICAgICBpbnB1dDogc291cmNlT3V0cHV0LFxuICAgICAgcm9sZTogY29kZUJ1aWxkU2VydmljZVJvbGUsXG4gICAgfSk7XG5cbiAgICBjb25zdCBzYW1CdWlsZFByb2plY3QgPSBuZXcgY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdChcbiAgICAgIHRoaXMsXG4gICAgICB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dChcImVudlwiKSArIFwiLW1lYWwtcGxhbm5lci1hcGktcGlwZWxpbmVcIixcbiAgICAgIHtcbiAgICAgICAgcHJvamVjdE5hbWU6XG4gICAgICAgICAgdGhpcy5ub2RlLnRyeUdldENvbnRleHQoXCJlbnZcIikgKyBcIi1tZWFsLXBsYW5uZXItYXBpLXByb2plY3RcIixcbiAgICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21Tb3VyY2VGaWxlbmFtZShcbiAgICAgICAgICBcImJ1aWxkc3BlYy1wYWNrYWdlLnltbFwiXG4gICAgICAgICksXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgYnVpbGRJbWFnZTogY29kZWJ1aWxkLkxpbnV4QnVpbGRJbWFnZS5TVEFOREFSRF80XzAsXG4gICAgICAgIH0sXG4gICAgICAgIHJvbGU6IGNvZGVCdWlsZFNlcnZpY2VSb2xlLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBCdWlsZCBhY3Rpb25zXG4gICAgLy8gTGludGluZyBhbmQgU0FNIHBhY2thZ2luZ1xuICAgIGNvbnN0IHBhY2thZ2luZ0FjdGlvbiA9IG5ldyBjb2RlcGlwZWxpbmVBY3Rpb25zLkNvZGVCdWlsZEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiBlbnYgKyBcIl9wYWNrYWdlX1NBTVwiLFxuICAgICAgcHJvamVjdDogc2FtQnVpbGRQcm9qZWN0LFxuICAgICAgaW5wdXQ6IHNvdXJjZU91dHB1dCxcbiAgICAgIG91dHB1dHM6IFtwYWNrYWdlU2FtT3V0cHV0XSxcbiAgICAgIHJvbGU6IGNvZGVCdWlsZFNlcnZpY2VSb2xlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgY2RrQnVpbGRPdXRwdXQgPSBuZXcgY29kZXBpcGVsaW5lLkFydGlmYWN0UGF0aChcbiAgICAgIHBhY2thZ2VTYW1PdXRwdXQsXG4gICAgICBcInBhY2thZ2VkLXRlbXBsYXRlLnlhbWxcIlxuICAgICk7XG5cbiAgICBjb25zdCBkZXBsb3lTYW1DaGFuZ2VTZXRBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lQWN0aW9ucy5DbG91ZEZvcm1hdGlvbkNyZWF0ZVJlcGxhY2VDaGFuZ2VTZXRBY3Rpb24oXG4gICAgICB7XG4gICAgICAgIGFjdGlvbk5hbWU6IGVudiArIFwiX2RlcGxveV9TQU1fY2hhbmdlc2V0XCIsXG4gICAgICAgIHN0YWNrTmFtZTogZW52ICsgXCItbWVhbC1wbGFubmVyLWFwaVwiLFxuICAgICAgICB0ZW1wbGF0ZVBhdGg6IGNka0J1aWxkT3V0cHV0LFxuICAgICAgICBhZG1pblBlcm1pc3Npb25zOiB0cnVlLFxuICAgICAgICBjaGFuZ2VTZXROYW1lOiBlbnYgKyBcIi1tZWFsLXBsYW5uZXItYXBpLWNoYW5nZXNldFwiLFxuICAgICAgICBkZXBsb3ltZW50Um9sZTogY2ZuU2VydmljZVJvbGUsXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IG15QnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcImFydGlmYWN0QnVja2V0XCIsIHtcbiAgICAgIHZlcnNpb25lZDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyBCdWlsZCB0aGUgZnVsbCBwaXBlbGluZVxuICAgIGNvbnN0IHBpcGVsaW5lID0gbmV3IGNvZGVwaXBlbGluZS5QaXBlbGluZSh0aGlzLCBcIkluZnJhUGlwZWxpbmVcIiwge1xuICAgICAgcGlwZWxpbmVOYW1lOiB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dChcImVudlwiKSArIFwiX2luZnJhX3BpcGVsaW5lXCIsXG4gICAgICBjcm9zc0FjY291bnRLZXlzOiBmYWxzZSxcbiAgICAgIGFydGlmYWN0QnVja2V0OiBteUJ1Y2tldCxcbiAgICAgIHJvbGU6IGNvZGVQaXBlbGluZVNlcnZpY2VSb2xlLFxuICAgIH0pO1xuXG4gICAgcGlwZWxpbmUuYWRkU3RhZ2Uoe1xuICAgICAgc3RhZ2VOYW1lOiBcIlNvdXJjZVwiLFxuICAgICAgYWN0aW9uczogW3NvdXJjZUFjdGlvbl0sXG4gICAgfSk7XG5cbiAgICBwaXBlbGluZS5hZGRTdGFnZSh7XG4gICAgICBzdGFnZU5hbWU6IFwiVGVzdEluZnJhXCIsXG4gICAgICBhY3Rpb25zOiBbcGlwZWxpbmVJbmZyYUFjdGlvbl0sXG4gICAgfSk7XG5cbiAgICBwaXBlbGluZS5hZGRTdGFnZSh7XG4gICAgICBzdGFnZU5hbWU6IFwiUGFja2FnZUFwcGxpY2F0aW9uXCIsXG4gICAgICBhY3Rpb25zOiBbcGFja2FnaW5nQWN0aW9uXSxcbiAgICB9KTtcblxuICAgIHBpcGVsaW5lLmFkZFN0YWdlKHtcbiAgICAgIHN0YWdlTmFtZTogXCJEZXBsb3lTYW1DaGFuZ2VTZXRcIixcbiAgICAgIGFjdGlvbnM6IFtkZXBsb3lTYW1DaGFuZ2VTZXRBY3Rpb25dLFxuICAgIH0pO1xuICB9XG59XG4iXX0=