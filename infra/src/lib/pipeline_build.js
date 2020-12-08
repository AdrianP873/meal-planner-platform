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
            assumedBy: new iam.CompositePrincipal(new iam.ServicePrincipal("codepipeline.amazonaws.com"), new iam.ServicePrincipal("codebuild.amazonaws.com"), new iam.AccountPrincipal(process.env.CDK_DEFAULT_ACCOUNT)),
            description: "Service role for CodeBuild",
        });
        codeBuildServiceRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ["*"],
            actions: [
                "s3:*",
                "logs:*",
                "cloudformation:*"
            ],
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
                "secretsmanager:*"
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
            connectionName: "github-connector-" + env,
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
            pipelineName: "meal_planner_platform_pipeline_" + env,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZWxpbmVfYnVpbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwaXBlbGluZV9idWlsZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxQ0FBcUM7QUFDckMsMERBQTBEO0FBQzFELHlFQUF5RTtBQUN6RSxvREFBb0Q7QUFDcEQsd0VBQXdFO0FBQ3hFLHdDQUF3QztBQUN4QyxzQ0FBc0M7QUFRdEMsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEMsa0dBQWtHO0lBQ2xHLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBZ0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQix3Q0FBd0M7UUFDeEMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFM0MsZ0JBQWdCO1FBQ2hCLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUN2QyxJQUFJLEVBQ0osaUNBQWlDLEVBQ2pDO1lBQ0UsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGtCQUFrQixDQUNuQyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyw0QkFBNEIsQ0FBQyxFQUN0RCxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx5QkFBeUIsQ0FBQyxFQUNuRCxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQzFEO1lBQ0QsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUNGLENBQUM7UUFFRixvQkFBb0IsQ0FBQyxXQUFXLENBQzlCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztZQUNoQixPQUFPLEVBQUU7Z0JBQ1AsTUFBTTtnQkFDTixRQUFRO2dCQUNS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YUFBYSxFQUFFLDZCQUE2QixHQUFHLEdBQUc7WUFDbEQsY0FBYyxFQUFFLGNBQWM7U0FDL0IsQ0FDRixDQUFDO1FBRUYsTUFBTSxRQUFRLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUNyRCxTQUFTLEVBQUUsS0FBSztTQUNqQixDQUFDLENBQUM7UUFFSCwwQkFBMEI7UUFDMUIsTUFBTSxRQUFRLEdBQUcsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDaEUsWUFBWSxFQUFFLGlDQUFpQyxHQUFHLEdBQUc7WUFDckQsZ0JBQWdCLEVBQUUsS0FBSztZQUN2QixjQUFjLEVBQUUsUUFBUTtZQUN4QixJQUFJLEVBQUUsdUJBQXVCO1NBQzlCLENBQUMsQ0FBQztRQUVILFFBQVEsQ0FBQyxRQUFRLENBQUM7WUFDaEIsU0FBUyxFQUFFLFFBQVE7WUFDbkIsT0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDO1NBQ3hCLENBQUMsQ0FBQztRQUVILFFBQVEsQ0FBQyxRQUFRLENBQUM7WUFDaEIsU0FBUyxFQUFFLFdBQVc7WUFDdEIsT0FBTyxFQUFFLENBQUMsbUJBQW1CLENBQUM7U0FDL0IsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUNoQixTQUFTLEVBQUUsb0JBQW9CO1lBQy9CLE9BQU8sRUFBRSxDQUFDLGVBQWUsQ0FBQztTQUMzQixDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsUUFBUSxDQUFDO1lBQ2hCLFNBQVMsRUFBRSxvQkFBb0I7WUFDL0IsT0FBTyxFQUFFLENBQUMsd0JBQXdCLENBQUM7U0FDcEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBaE5ELGtDQWdOQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tIFwiQGF3cy1jZGsvY29yZVwiO1xuaW1wb3J0ICogYXMgY29kZXBpcGVsaW5lIGZyb20gXCJAYXdzLWNkay9hd3MtY29kZXBpcGVsaW5lXCI7XG5pbXBvcnQgKiBhcyBjb2RlcGlwZWxpbmVBY3Rpb25zIGZyb20gXCJAYXdzLWNkay9hd3MtY29kZXBpcGVsaW5lLWFjdGlvbnNcIjtcbmltcG9ydCAqIGFzIGNvZGVidWlsZCBmcm9tIFwiQGF3cy1jZGsvYXdzLWNvZGVidWlsZFwiO1xuaW1wb3J0ICogYXMgY29kZXN0YXJjb25uZWN0aW9ucyBmcm9tIFwiQGF3cy1jZGsvYXdzLWNvZGVzdGFyY29ubmVjdGlvbnNcIjtcbmltcG9ydCAqIGFzIGlhbSBmcm9tIFwiQGF3cy1jZGsvYXdzLWlhbVwiO1xuaW1wb3J0ICogYXMgczMgZnJvbSBcIkBhd3MtY2RrL2F3cy1zM1wiO1xuaW1wb3J0ICogYXMgQXdzIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xuaW1wb3J0IHsgQ2ZuT3V0cHV0IH0gZnJvbSBcIkBhd3MtY2RrL2NvcmVcIjtcblxuZXhwb3J0IGludGVyZmFjZSBFbnZQcm9wcyB7XG4gIHByb2Q6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBQaXBlbGluZUFQSSBleHRlbmRzIGNkay5TdGFjayB7XG4gIC8vIENyZWF0ZXMgdGhlIFBpcGVsaW5lIGZvciB0aGUgbWVhbCBwbGFubmVyIEFQSS4gVGhlIHBpcGVsaW5lIHByb3Zpc2lvbnMgaW5mcmFzdHJ1Y3R1cmUgd2l0aCBTQU0uXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBjZGsuQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IEVudlByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIFNldCBlbnZpcm9ubWVudCBjb250ZXh0IGFzIGEgdmFyaWFibGVcbiAgICBjb25zdCBlbnYgPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dChcImVudlwiKTtcblxuICAgIC8vIFNlcnZpY2Ugcm9sZXNcbiAgICBjb25zdCBjb2RlQnVpbGRTZXJ2aWNlUm9sZSA9IG5ldyBpYW0uUm9sZShcbiAgICAgIHRoaXMsXG4gICAgICBcIm1lYWxQbGFubmVyQ29kZUJ1aWxkU2VydmljZVJvbGVcIixcbiAgICAgIHtcbiAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkNvbXBvc2l0ZVByaW5jaXBhbChcbiAgICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJjb2RlcGlwZWxpbmUuYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJjb2RlYnVpbGQuYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgICAgICBuZXcgaWFtLkFjY291bnRQcmluY2lwYWwocHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVClcbiAgICAgICAgKSxcbiAgICAgICAgZGVzY3JpcHRpb246IFwiU2VydmljZSByb2xlIGZvciBDb2RlQnVpbGRcIixcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29kZUJ1aWxkU2VydmljZVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJzMzoqXCIsXG4gICAgICAgICAgXCJsb2dzOipcIixcbiAgICAgICAgICBcImNsb3VkZm9ybWF0aW9uOipcIl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBjb25zdCBjZm5TZXJ2aWNlUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIm1lYWxQbGFubmVyQ2ZuU2VydmljZVJvbGVcIiwge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJjbG91ZGZvcm1hdGlvbi5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgZGVzY3JpcHRpb246IFwiU2VydmljZSByb2xlIGZvciBDbG91ZEZvcm1hdGlvblwiLFxuICAgIH0pO1xuXG4gICAgY2ZuU2VydmljZVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJhcGlnYXRld2F5OipcIixcbiAgICAgICAgICBcImNsb3VkZm9ybWF0aW9uOipcIixcbiAgICAgICAgICBcImNsb3Vkd2F0Y2g6KlwiLFxuICAgICAgICAgIFwiZHluYW1vZGI6KlwiLFxuICAgICAgICAgIFwiZXZlbnRzOipcIixcbiAgICAgICAgICBcImlhbToqXCIsXG4gICAgICAgICAgXCJsYW1iZGE6KlwiLFxuICAgICAgICAgIFwiczM6KlwiLFxuICAgICAgICAgIFwic2VjcmV0c21hbmFnZXI6KlwiXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBjb25zdCBjb2RlUGlwZWxpbmVTZXJ2aWNlUm9sZSA9IG5ldyBpYW0uUm9sZShcbiAgICAgIHRoaXMsXG4gICAgICBcIm1lYWxQbGFubmVyQ29kZVBpcGVsaW5lU2VydmljZVJvbGVcIixcbiAgICAgIHtcbiAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJjb2RlcGlwZWxpbmUuYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgICAgZGVzY3JpcHRpb246IFwiU2VydmljZSByb2xlIGZvciBDb2RlUGlwZWxpbmVcIixcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29kZVBpcGVsaW5lU2VydmljZVJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgcmVzb3VyY2VzOiBbXCIqXCJdLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgXCJpYW06UGFzc1JvbGVcIixcbiAgICAgICAgICBcImFwaWdhdGV3YXk6KlwiLFxuICAgICAgICAgIFwiY2xvdWRmb3JtYXRpb246KlwiLFxuICAgICAgICAgIFwiY2xvdWR3YXRjaDoqXCIsXG4gICAgICAgICAgXCJjb2RlYnVpbGQ6KlwiLFxuICAgICAgICAgIFwiZHluYW1vZGI6KlwiLFxuICAgICAgICAgIFwiczM6KlwiLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgY29uc3Qgc291cmNlT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgpO1xuICAgIGNvbnN0IHBhY2thZ2VTYW1PdXRwdXQgPSBuZXcgY29kZXBpcGVsaW5lLkFydGlmYWN0KFwicGFja2FnZVwiKTtcbiAgICBcbiAgICBjb25zdCBjb2Rlc3RhckNvbm5lY3Rpb24gPSBuZXcgY29kZXN0YXJjb25uZWN0aW9ucy5DZm5Db25uZWN0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgIFwiZ2l0aHViLWNvbm5lY3Rpb24tXCIgKyBlbnYsXG4gICAgICB7XG4gICAgICAgIGNvbm5lY3Rpb25OYW1lOiBcImdpdGh1Yi1jb25uZWN0b3ItXCIgKyBlbnYsXG4gICAgICAgIHByb3ZpZGVyVHlwZTogXCJHaXRIdWJcIixcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gU2V0IHRoZSBicmFuY2ggbmFtZVxuICAgIHZhciBicmFuY2hOYW1lID0gcHJvY2Vzcy5lbnYuQlJBTkNIIHx8IFwic3RhZ2luZ1wiO1xuXG4gICAgLy8gU1RBR0UgQUNUSU9OU1xuICAgIC8vIFNvdXJjZSBhY3Rpb25cbiAgICBjb25zdCBzb3VyY2VBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lQWN0aW9ucy5CaXRCdWNrZXRTb3VyY2VBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogXCJTb3VyY2VfR2l0SHViXCIsXG4gICAgICBvd25lcjogXCJBZHJpYW5QODczXCIsXG4gICAgICByZXBvOiBcIm1lYWwtcGxhbm5lci1wbGF0Zm9ybVwiLFxuICAgICAgb3V0cHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICBjb25uZWN0aW9uQXJuOiBjb2Rlc3RhckNvbm5lY3Rpb24uYXR0ckNvbm5lY3Rpb25Bcm4sXG4gICAgICBicmFuY2g6IGJyYW5jaE5hbWUsXG4gICAgfSk7XG5cbiAgICAvLyBCdWlsZCBQcm9qZWN0c1xuICAgIGNvbnN0IHBpcGVsaW5lSW5mcmFCdWlsZFByb2plY3QgPSBuZXcgY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdChcbiAgICAgIHRoaXMsXG4gICAgICBcIm1lYWwtcGxhbm5lci1pbmZyYS1idWlsZC1cIiArIGVudixcbiAgICAgIHtcbiAgICAgICAgcHJvamVjdE5hbWU6XG4gICAgICAgICAgXCJtZWFsLXBsYW5lci1hcGktcHJvamVjdC1cIiArIGVudixcbiAgICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21Tb3VyY2VGaWxlbmFtZShcbiAgICAgICAgICBcImJ1aWxkc3BlYy1waXBlbGluZS1pbmZyYS55bWxcIlxuICAgICAgICApLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuU1RBTkRBUkRfNF8wLFxuICAgICAgICB9LFxuICAgICAgICByb2xlOiBjb2RlQnVpbGRTZXJ2aWNlUm9sZSxcbiAgICAgICAgZW52aXJvbm1lbnRWYXJpYWJsZXM6IHtcbiAgICAgICAgICBFTlY6IHsgdmFsdWU6IGVudiB9LFxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBwaXBlbGluZUluZnJhQWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZUFjdGlvbnMuQ29kZUJ1aWxkQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6IFwibWVhbF9wbGFubmVyX3BpcGVsaW5lX2J1aWxkX1wiICsgZW52LFxuICAgICAgcHJvamVjdDogcGlwZWxpbmVJbmZyYUJ1aWxkUHJvamVjdCxcbiAgICAgIGlucHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICByb2xlOiBjb2RlQnVpbGRTZXJ2aWNlUm9sZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHNhbUJ1aWxkUHJvamVjdCA9IG5ldyBjb2RlYnVpbGQuUGlwZWxpbmVQcm9qZWN0KFxuICAgICAgdGhpcyxcbiAgICAgIFwibWVhbC1wbGFubmVyLWFwaS1waXBlbGluZS1cIiArIGVudixcbiAgICAgIHtcbiAgICAgICAgcHJvamVjdE5hbWU6XG4gICAgICAgICAgXCJtZWFsLXBsYW5uZXItYXBpLXByb2plY3QtXCIgKyBlbnYsXG4gICAgICAgIGJ1aWxkU3BlYzogY29kZWJ1aWxkLkJ1aWxkU3BlYy5mcm9tU291cmNlRmlsZW5hbWUoXG4gICAgICAgICAgXCJidWlsZHNwZWMtcGFja2FnZS55bWxcIlxuICAgICAgICApLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuU1RBTkRBUkRfNF8wLFxuICAgICAgICB9LFxuICAgICAgICByb2xlOiBjb2RlQnVpbGRTZXJ2aWNlUm9sZSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQnVpbGQgYWN0aW9uc1xuICAgIC8vIExpbnRpbmcgYW5kIFNBTSBwYWNrYWdpbmdcbiAgICBjb25zdCBwYWNrYWdpbmdBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lQWN0aW9ucy5Db2RlQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogXCJwYWNrYWdlX1NBTV9cIiArIGVudixcbiAgICAgIHByb2plY3Q6IHNhbUJ1aWxkUHJvamVjdCxcbiAgICAgIGlucHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICBvdXRwdXRzOiBbcGFja2FnZVNhbU91dHB1dF0sXG4gICAgICByb2xlOiBjb2RlQnVpbGRTZXJ2aWNlUm9sZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGNka0J1aWxkT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdFBhdGgoXG4gICAgICBwYWNrYWdlU2FtT3V0cHV0LFxuICAgICAgXCJwYWNrYWdlZC10ZW1wbGF0ZS55YW1sXCJcbiAgICApO1xuXG4gICAgY29uc3QgZGVwbG95U2FtQ2hhbmdlU2V0QWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZUFjdGlvbnMuQ2xvdWRGb3JtYXRpb25DcmVhdGVSZXBsYWNlQ2hhbmdlU2V0QWN0aW9uKFxuICAgICAge1xuICAgICAgICBhY3Rpb25OYW1lOiBcImRlcGxveV9TQU1fY2hhbmdlc2V0X1wiICsgZW52LFxuICAgICAgICBzdGFja05hbWU6IFwibWVhbC1wbGFubmVyLWFwaS1cIiArIGVudixcbiAgICAgICAgdGVtcGxhdGVQYXRoOiBjZGtCdWlsZE91dHB1dCxcbiAgICAgICAgYWRtaW5QZXJtaXNzaW9uczogdHJ1ZSxcbiAgICAgICAgY2hhbmdlU2V0TmFtZTogXCJtZWFsLXBsYW5uZXItYXBpLWNoYW5nZXNldC1cIiArIGVudixcbiAgICAgICAgZGVwbG95bWVudFJvbGU6IGNmblNlcnZpY2VSb2xlLFxuICAgICAgfVxuICAgICk7XG5cbiAgICBjb25zdCBteUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgXCJhcnRpZmFjdEJ1Y2tldFwiLCB7XG4gICAgICB2ZXJzaW9uZWQ6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgLy8gQnVpbGQgdGhlIGZ1bGwgcGlwZWxpbmVcbiAgICBjb25zdCBwaXBlbGluZSA9IG5ldyBjb2RlcGlwZWxpbmUuUGlwZWxpbmUodGhpcywgXCJJbmZyYVBpcGVsaW5lXCIsIHtcbiAgICAgIHBpcGVsaW5lTmFtZTogXCJtZWFsX3BsYW5uZXJfcGxhdGZvcm1fcGlwZWxpbmVfXCIgKyBlbnYsXG4gICAgICBjcm9zc0FjY291bnRLZXlzOiBmYWxzZSxcbiAgICAgIGFydGlmYWN0QnVja2V0OiBteUJ1Y2tldCxcbiAgICAgIHJvbGU6IGNvZGVQaXBlbGluZVNlcnZpY2VSb2xlLFxuICAgIH0pO1xuXG4gICAgcGlwZWxpbmUuYWRkU3RhZ2Uoe1xuICAgICAgc3RhZ2VOYW1lOiBcIlNvdXJjZVwiLFxuICAgICAgYWN0aW9uczogW3NvdXJjZUFjdGlvbl0sXG4gICAgfSk7XG5cbiAgICBwaXBlbGluZS5hZGRTdGFnZSh7XG4gICAgICBzdGFnZU5hbWU6IFwiVGVzdEluZnJhXCIsXG4gICAgICBhY3Rpb25zOiBbcGlwZWxpbmVJbmZyYUFjdGlvbl0sXG4gICAgfSk7XG5cbiAgICBwaXBlbGluZS5hZGRTdGFnZSh7XG4gICAgICBzdGFnZU5hbWU6IFwiUGFja2FnZUFwcGxpY2F0aW9uXCIsXG4gICAgICBhY3Rpb25zOiBbcGFja2FnaW5nQWN0aW9uXSxcbiAgICB9KTtcblxuICAgIHBpcGVsaW5lLmFkZFN0YWdlKHtcbiAgICAgIHN0YWdlTmFtZTogXCJEZXBsb3lTYW1DaGFuZ2VTZXRcIixcbiAgICAgIGFjdGlvbnM6IFtkZXBsb3lTYW1DaGFuZ2VTZXRBY3Rpb25dLFxuICAgIH0pO1xuICB9XG59XG4iXX0=