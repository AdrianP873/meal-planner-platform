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
        // Set environment context as a variable
        const env = this.node.tryGetContext("env");
        // Service roles
        const codeBuildServiceRole = new iam.Role(this, "mealPlannerCodeBuildServiceRole", {
            assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal("codepipeline.amazonaws.com"), new iam.ServicePrincipal("codebuild.amazonaws.com")),
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
        const codestarConnection = new codestarconnections.CfnConnection(this, "github-connection-" + env, {
            connectionName: "meal-planner-github-connector-" + env,
            providerType: "GitHub",
        });
        // Set the branch name
        var branchName = process.env.BRANCH || "staging";
        // STAGE ACTIONS
        // Source action
        const sourceAction = new codepipelineActions.BitBucketSourceAction({
            actionName: "Source_GitHub",
            owner: "AdrianP873",
            repo: "meal-planner-platform",
            output: sourceOutput,
            connectionArn: codestarConnection.attrConnectionArn,
            branch: branchName,
        });
        // Build Projects
        const pipelineInfraBuildProject = new codebuild.PipelineProject(this, "meal-planner-infra-build-" + env, {
            projectName: "meal-planer-api-project-" + env,
            buildSpec: codebuild.BuildSpec.fromSourceFilename("buildspec-pipeline-infra.yml"),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
            },
            role: codeBuildServiceRole,
            environmentVariables: {
                ENV: { value: env },
            },
        });
        const pipelineInfraAction = new codepipelineActions.CodeBuildAction({
            actionName: "meal_planner_pipeline_build_" + env,
            project: pipelineInfraBuildProject,
            input: sourceOutput,
            role: codeBuildServiceRole,
        });
        const samBuildProject = new codebuild.PipelineProject(this, "meal-planner-api-pipeline-" + env, {
            projectName: "meal-planner-api-project-" + env,
            buildSpec: codebuild.BuildSpec.fromSourceFilename("buildspec-package.yml"),
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
            },
            role: codeBuildServiceRole,
        });
        // Build actions
        // Linting and SAM packaging
        const packagingAction = new codepipelineActions.CodeBuildAction({
            actionName: "package_SAM_" + env,
            project: samBuildProject,
            input: sourceOutput,
            outputs: [packageSamOutput],
            role: codeBuildServiceRole,
        });
        const cdkBuildOutput = new codepipeline.ArtifactPath(packageSamOutput, "packaged-template.yaml");
        const deploySamChangeSetAction = new codepipelineActions.CloudFormationCreateReplaceChangeSetAction({
            actionName: "deploy_SAM_changeset_" + env,
            stackName: "meal-planner-api-" + env,
            templatePath: cdkBuildOutput,
            adminPermissions: true,
            changeSetName: "meal-planner-api-changeset-" + env,
            deploymentRole: cfnServiceRole,
        });
        const myBucket = new s3.Bucket(this, "artifactBucket", {
            versioned: false,
        });
        // Build the full pipeline
        const pipeline = new codepipeline.Pipeline(this, "InfraPipeline", {
            pipelineName: "infra_pipeline_" + env,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZWxpbmVfYnVpbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwaXBlbGluZV9idWlsZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxQ0FBcUM7QUFDckMsMERBQTBEO0FBQzFELHlFQUF5RTtBQUN6RSxvREFBb0Q7QUFDcEQsd0VBQXdFO0FBQ3hFLHdDQUF3QztBQUN4QyxzQ0FBc0M7QUFPdEMsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEMsa0dBQWtHO0lBQ2xHLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQix3Q0FBd0M7UUFDeEMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFM0MsZ0JBQWdCO1FBQ2hCLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUN2QyxJQUFJLEVBQ0osaUNBQWlDLEVBQ2pDO1lBQ0UsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGtCQUFrQixDQUNuQyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyw0QkFBNEIsQ0FBQyxFQUN0RCxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx5QkFBeUIsQ0FBQyxDQUNwRDtZQUNELFdBQVcsRUFBRSw0QkFBNEI7U0FDMUMsQ0FDRixDQUFDO1FBRUYsb0JBQW9CLENBQUMsV0FBVyxDQUM5QixJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDdEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7WUFDaEIsT0FBTyxFQUFFLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQztTQUNoRCxDQUFDLENBQ0gsQ0FBQztRQUVGLE1BQU0sY0FBYyxHQUFHLElBQUksR0FBRyxDQUFD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RyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3JELFNBQVMsRUFBRSxLQUFLO1NBQ2pCLENBQUMsQ0FBQztRQUVILDBCQUEwQjtRQUMxQixNQUFNLFFBQVEsR0FBRyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUNoRSxZQUFZLEVBQUUsaUJBQWlCLEdBQUcsR0FBRztZQUNyQyxnQkFBZ0IsRUFBRSxLQUFLO1lBQ3ZCLGNBQWMsRUFBRSxRQUFRO1lBQ3hCLElBQUksRUFBRSx1QkFBdUI7U0FDOUIsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUNoQixTQUFTLEVBQUUsUUFBUTtZQUNuQixPQUFPLEVBQUUsQ0FBQyxZQUFZLENBQUM7U0FDeEIsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUNoQixTQUFTLEVBQUUsV0FBVztZQUN0QixPQUFPLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQztTQUMvQixDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsUUFBUSxDQUFDO1lBQ2hCLFNBQVMsRUFBRSxvQkFBb0I7WUFDL0IsT0FBTyxFQUFFLENBQUMsZUFBZSxDQUFDO1NBQzNCLENBQUMsQ0FBQztRQUVILFFBQVEsQ0FBQyxRQUFRLENBQUM7WUFDaEIsU0FBUyxFQUFFLG9CQUFvQjtZQUMvQixPQUFPLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQztTQUNwQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUEzTUQsa0NBMk1DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gXCJAYXdzLWNkay9jb3JlXCI7XG5pbXBvcnQgKiBhcyBjb2RlcGlwZWxpbmUgZnJvbSBcIkBhd3MtY2RrL2F3cy1jb2RlcGlwZWxpbmVcIjtcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZUFjdGlvbnMgZnJvbSBcIkBhd3MtY2RrL2F3cy1jb2RlcGlwZWxpbmUtYWN0aW9uc1wiO1xuaW1wb3J0ICogYXMgY29kZWJ1aWxkIGZyb20gXCJAYXdzLWNkay9hd3MtY29kZWJ1aWxkXCI7XG5pbXBvcnQgKiBhcyBjb2Rlc3RhcmNvbm5lY3Rpb25zIGZyb20gXCJAYXdzLWNkay9hd3MtY29kZXN0YXJjb25uZWN0aW9uc1wiO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gXCJAYXdzLWNkay9hd3MtaWFtXCI7XG5pbXBvcnQgKiBhcyBzMyBmcm9tIFwiQGF3cy1jZGsvYXdzLXMzXCI7XG5cblxuZXhwb3J0IGludGVyZmFjZSBFbnZQcm9wcyB7XG4gIHByb2Q6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBQaXBlbGluZUFQSSBleHRlbmRzIGNkay5TdGFjayB7XG4gIC8vIENyZWF0ZXMgdGhlIFBpcGVsaW5lIGZvciB0aGUgbWVhbCBwbGFubmVyIEFQSS4gVGhlIHBpcGVsaW5lIHByb3Zpc2lvbnMgaW5mcmFzdHJ1Y3R1cmUgd2l0aCBTQU0uXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IEVudlByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIFNldCBlbnZpcm9ubWVudCBjb250ZXh0IGFzIGEgdmFyaWFibGVcbiAgICBjb25zdCBlbnYgPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dChcImVudlwiKTtcblxuICAgIC8vIFNlcnZpY2Ugcm9sZXNcbiAgICBjb25zdCBjb2RlQnVpbGRTZXJ2aWNlUm9sZSA9IG5ldyBpYW0uUm9sZShcbiAgICAgIHRoaXMsXG4gICAgICBcIm1lYWxQbGFubmVyQ29kZUJ1aWxkU2VydmljZVJvbGVcIixcbiAgICAgIHtcbiAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkNvbXBvc2l0ZVByaW5jaXBhbChcbiAgICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJjb2RlcGlwZWxpbmUuYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJjb2RlYnVpbGQuYW1hem9uYXdzLmNvbVwiKVxuICAgICAgICApLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJTZXJ2aWNlIHJvbGUgZm9yIENvZGVCdWlsZFwiLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb2RlQnVpbGRTZXJ2aWNlUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICAgIGFjdGlvbnM6IFtcInMzOipcIiwgXCJsb2dzOipcIiwgXCJjbG91ZGZvcm1hdGlvbjoqXCJdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgY29uc3QgY2ZuU2VydmljZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgXCJtZWFsUGxhbm5lckNmblNlcnZpY2VSb2xlXCIsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiY2xvdWRmb3JtYXRpb24uYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlNlcnZpY2Ugcm9sZSBmb3IgQ2xvdWRGb3JtYXRpb25cIixcbiAgICB9KTtcblxuICAgIGNmblNlcnZpY2VSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgIFwiYXBpZ2F0ZXdheToqXCIsXG4gICAgICAgICAgXCJjbG91ZGZvcm1hdGlvbjoqXCIsXG4gICAgICAgICAgXCJjbG91ZHdhdGNoOipcIixcbiAgICAgICAgICBcImR5bmFtb2RiOipcIixcbiAgICAgICAgICBcImV2ZW50czoqXCIsXG4gICAgICAgICAgXCJpYW06KlwiLFxuICAgICAgICAgIFwibGFtYmRhOipcIixcbiAgICAgICAgICBcInMzOipcIixcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGNvbnN0IGNvZGVQaXBlbGluZVNlcnZpY2VSb2xlID0gbmV3IGlhbS5Sb2xlKFxuICAgICAgdGhpcyxcbiAgICAgIFwibWVhbFBsYW5uZXJDb2RlUGlwZWxpbmVTZXJ2aWNlUm9sZVwiLFxuICAgICAge1xuICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImNvZGVwaXBlbGluZS5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJTZXJ2aWNlIHJvbGUgZm9yIENvZGVQaXBlbGluZVwiLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb2RlUGlwZWxpbmVTZXJ2aWNlUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICBcImlhbTpQYXNzUm9sZVwiLFxuICAgICAgICAgIFwiYXBpZ2F0ZXdheToqXCIsXG4gICAgICAgICAgXCJjbG91ZGZvcm1hdGlvbjoqXCIsXG4gICAgICAgICAgXCJjbG91ZHdhdGNoOipcIixcbiAgICAgICAgICBcImNvZGVidWlsZDoqXCIsXG4gICAgICAgICAgXCJkeW5hbW9kYjoqXCIsXG4gICAgICAgICAgXCJzMzoqXCIsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBjb25zdCBzb3VyY2VPdXRwdXQgPSBuZXcgY29kZXBpcGVsaW5lLkFydGlmYWN0KCk7XG4gICAgY29uc3QgcGFja2FnZVNhbU91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoXCJwYWNrYWdlXCIpO1xuICAgIFxuICAgIGNvbnN0IGNvZGVzdGFyQ29ubmVjdGlvbiA9IG5ldyBjb2Rlc3RhcmNvbm5lY3Rpb25zLkNmbkNvbm5lY3Rpb24oXG4gICAgICB0aGlzLFxuICAgICAgXCJnaXRodWItY29ubmVjdGlvbi1cIiArIGVudixcbiAgICAgIHtcbiAgICAgICAgY29ubmVjdGlvbk5hbWU6IFwibWVhbC1wbGFubmVyLWdpdGh1Yi1jb25uZWN0b3ItXCIgKyBlbnYsXG4gICAgICAgIHByb3ZpZGVyVHlwZTogXCJHaXRIdWJcIixcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gU2V0IHRoZSBicmFuY2ggbmFtZVxuICAgIHZhciBicmFuY2hOYW1lID0gcHJvY2Vzcy5lbnYuQlJBTkNIIHx8IFwic3RhZ2luZ1wiO1xuXG4gICAgLy8gU1RBR0UgQUNUSU9OU1xuICAgIC8vIFNvdXJjZSBhY3Rpb25cbiAgICBjb25zdCBzb3VyY2VBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lQWN0aW9ucy5CaXRCdWNrZXRTb3VyY2VBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogXCJTb3VyY2VfR2l0SHViXCIsXG4gICAgICBvd25lcjogXCJBZHJpYW5QODczXCIsXG4gICAgICByZXBvOiBcIm1lYWwtcGxhbm5lci1wbGF0Zm9ybVwiLFxuICAgICAgb3V0cHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICBjb25uZWN0aW9uQXJuOiBjb2Rlc3RhckNvbm5lY3Rpb24uYXR0ckNvbm5lY3Rpb25Bcm4sXG4gICAgICBicmFuY2g6IGJyYW5jaE5hbWUsXG4gICAgfSk7XG5cbiAgICAvLyBCdWlsZCBQcm9qZWN0c1xuICAgIGNvbnN0IHBpcGVsaW5lSW5mcmFCdWlsZFByb2plY3QgPSBuZXcgY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdChcbiAgICAgIHRoaXMsXG4gICAgICBcIm1lYWwtcGxhbm5lci1pbmZyYS1idWlsZC1cIiArIGVudixcbiAgICAgIHtcbiAgICAgICAgcHJvamVjdE5hbWU6XG4gICAgICAgICAgXCJtZWFsLXBsYW5lci1hcGktcHJvamVjdC1cIiArIGVudixcbiAgICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21Tb3VyY2VGaWxlbmFtZShcbiAgICAgICAgICBcImJ1aWxkc3BlYy1waXBlbGluZS1pbmZyYS55bWxcIlxuICAgICAgICApLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuU1RBTkRBUkRfNF8wLFxuICAgICAgICB9LFxuICAgICAgICByb2xlOiBjb2RlQnVpbGRTZXJ2aWNlUm9sZSxcbiAgICAgICAgZW52aXJvbm1lbnRWYXJpYWJsZXM6IHtcbiAgICAgICAgICBFTlY6IHsgdmFsdWU6IGVudiB9LFxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBwaXBlbGluZUluZnJhQWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZUFjdGlvbnMuQ29kZUJ1aWxkQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6IFwibWVhbF9wbGFubmVyX3BpcGVsaW5lX2J1aWxkX1wiICsgZW52LFxuICAgICAgcHJvamVjdDogcGlwZWxpbmVJbmZyYUJ1aWxkUHJvamVjdCxcbiAgICAgIGlucHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICByb2xlOiBjb2RlQnVpbGRTZXJ2aWNlUm9sZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHNhbUJ1aWxkUHJvamVjdCA9IG5ldyBjb2RlYnVpbGQuUGlwZWxpbmVQcm9qZWN0KFxuICAgICAgdGhpcyxcbiAgICAgIFwibWVhbC1wbGFubmVyLWFwaS1waXBlbGluZS1cIiArIGVudixcbiAgICAgIHtcbiAgICAgICAgcHJvamVjdE5hbWU6XG4gICAgICAgICAgXCJtZWFsLXBsYW5uZXItYXBpLXByb2plY3QtXCIgKyBlbnYsXG4gICAgICAgIGJ1aWxkU3BlYzogY29kZWJ1aWxkLkJ1aWxkU3BlYy5mcm9tU291cmNlRmlsZW5hbWUoXG4gICAgICAgICAgXCJidWlsZHNwZWMtcGFja2FnZS55bWxcIlxuICAgICAgICApLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuU1RBTkRBUkRfNF8wLFxuICAgICAgICB9LFxuICAgICAgICByb2xlOiBjb2RlQnVpbGRTZXJ2aWNlUm9sZSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQnVpbGQgYWN0aW9uc1xuICAgIC8vIExpbnRpbmcgYW5kIFNBTSBwYWNrYWdpbmdcbiAgICBjb25zdCBwYWNrYWdpbmdBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lQWN0aW9ucy5Db2RlQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogXCJwYWNrYWdlX1NBTV9cIiArIGVudixcbiAgICAgIHByb2plY3Q6IHNhbUJ1aWxkUHJvamVjdCxcbiAgICAgIGlucHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICBvdXRwdXRzOiBbcGFja2FnZVNhbU91dHB1dF0sXG4gICAgICByb2xlOiBjb2RlQnVpbGRTZXJ2aWNlUm9sZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNka0J1aWxkT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdFBhdGgoXG4gICAgICBwYWNrYWdlU2FtT3V0cHV0LFxuICAgICAgXCJwYWNrYWdlZC10ZW1wbGF0ZS55YW1sXCJcbiAgICApO1xuXG4gICAgY29uc3QgZGVwbG95U2FtQ2hhbmdlU2V0QWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZUFjdGlvbnMuQ2xvdWRGb3JtYXRpb25DcmVhdGVSZXBsYWNlQ2hhbmdlU2V0QWN0aW9uKFxuICAgICAge1xuICAgICAgICBhY3Rpb25OYW1lOiBcImRlcGxveV9TQU1fY2hhbmdlc2V0X1wiICsgZW52LFxuICAgICAgICBzdGFja05hbWU6IFwibWVhbC1wbGFubmVyLWFwaS1cIiArIGVudixcbiAgICAgICAgdGVtcGxhdGVQYXRoOiBjZGtCdWlsZE91dHB1dCxcbiAgICAgICAgYWRtaW5QZXJtaXNzaW9uczogdHJ1ZSxcbiAgICAgICAgY2hhbmdlU2V0TmFtZTogXCJtZWFsLXBsYW5uZXItYXBpLWNoYW5nZXNldC1cIiArIGVudixcbiAgICAgICAgZGVwbG95bWVudFJvbGU6IGNmblNlcnZpY2VSb2xlLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBteUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgXCJhcnRpZmFjdEJ1Y2tldFwiLCB7XG4gICAgICB2ZXJzaW9uZWQ6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgLy8gQnVpbGQgdGhlIGZ1bGwgcGlwZWxpbmVcbiAgICBjb25zdCBwaXBlbGluZSA9IG5ldyBjb2RlcGlwZWxpbmUuUGlwZWxpbmUodGhpcywgXCJJbmZyYVBpcGVsaW5lXCIsIHtcbiAgICAgIHBpcGVsaW5lTmFtZTogXCJpbmZyYV9waXBlbGluZV9cIiArIGVudixcbiAgICAgIGNyb3NzQWNjb3VudEtleXM6IGZhbHNlLFxuICAgICAgYXJ0aWZhY3RCdWNrZXQ6IG15QnVja2V0LFxuICAgICAgcm9sZTogY29kZVBpcGVsaW5lU2VydmljZVJvbGUsXG4gICAgfSk7XG5cbiAgICBwaXBlbGluZS5hZGRTdGFnZSh7XG4gICAgICBzdGFnZU5hbWU6IFwiU291cmNlXCIsXG4gICAgICBhY3Rpb25zOiBbc291cmNlQWN0aW9uXSxcbiAgICB9KTtcblxuICAgIHBpcGVsaW5lLmFkZFN0YWdlKHtcbiAgICAgIHN0YWdlTmFtZTogXCJUZXN0SW5mcmFcIixcbiAgICAgIGFjdGlvbnM6IFtwaXBlbGluZUluZnJhQWN0aW9uXSxcbiAgICB9KTtcblxuICAgIHBpcGVsaW5lLmFkZFN0YWdlKHtcbiAgICAgIHN0YWdlTmFtZTogXCJQYWNrYWdlQXBwbGljYXRpb25cIixcbiAgICAgIGFjdGlvbnM6IFtwYWNrYWdpbmdBY3Rpb25dLFxuICAgIH0pO1xuXG4gICAgcGlwZWxpbmUuYWRkU3RhZ2Uoe1xuICAgICAgc3RhZ2VOYW1lOiBcIkRlcGxveVNhbUNoYW5nZVNldFwiLFxuICAgICAgYWN0aW9uczogW2RlcGxveVNhbUNoYW5nZVNldEFjdGlvbl0sXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==