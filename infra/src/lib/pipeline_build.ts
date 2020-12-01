import * as cdk from "@aws-cdk/core";
import * as codepipeline from "@aws-cdk/aws-codepipeline";
import * as codepipelineActions from "@aws-cdk/aws-codepipeline-actions";
import * as codebuild from "@aws-cdk/aws-codebuild";
import * as codestarconnections from "@aws-cdk/aws-codestarconnections";
import * as iam from "@aws-cdk/aws-iam";
import * as s3 from "@aws-cdk/aws-s3";


export interface EnvProps {
  prod: boolean;
}

export class PipelineAPI extends cdk.Stack {
  // Creates the Pipeline for the meal planner API. The pipeline provisions infrastructure with SAM.
  constructor(scope: cdk.Construct, id: string, props?: EnvProps) {
    super(scope, id);

    // Set environment context as a variable
    const env = this.node.tryGetContext("env");

    // Service roles
    const codeBuildServiceRole = new iam.Role(
      this,
      "mealPlannerCodeBuildServiceRole",
      {
        assumedBy: new iam.CompositePrincipal(
          new iam.ServicePrincipal("codepipeline.amazonaws.com"),
          new iam.ServicePrincipal("codebuild.amazonaws.com")
        ),
        description: "Service role for CodeBuild",
      }
    );

    codeBuildServiceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
          "s3:*",
          "logs:*",
          "cloudformation:*",
          "iam:*"],
      })
    );

    const cfnServiceRole = new iam.Role(this, "mealPlannerCfnServiceRole", {
      assumedBy: new iam.ServicePrincipal("cloudformation.amazonaws.com"),
      description: "Service role for CloudFormation",
    });

    cfnServiceRole.addToPolicy(
      new iam.PolicyStatement({
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
      })
    );

    const codePipelineServiceRole = new iam.Role(
      this,
      "mealPlannerCodePipelineServiceRole",
      {
        assumedBy: new iam.ServicePrincipal("codepipeline.amazonaws.com"),
        description: "Service role for CodePipeline",
      }
    );

    codePipelineServiceRole.addToPolicy(
      new iam.PolicyStatement({
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
      })
    );

    const sourceOutput = new codepipeline.Artifact();
    const packageSamOutput = new codepipeline.Artifact("package");
    
    const codestarConnection = new codestarconnections.CfnConnection(
      this,
      "github-connection-" + env,
      {
        connectionName: "github-connector-" + env,
        providerType: "GitHub",
      }
    );

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
    const pipelineInfraBuildProject = new codebuild.PipelineProject(
      this,
      "meal-planner-infra-build-" + env,
      {
        projectName:
          "meal-planer-api-project-" + env,
        buildSpec: codebuild.BuildSpec.fromSourceFilename(
          "buildspec-pipeline-infra.yml"
        ),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
        },
        role: codeBuildServiceRole,
        environmentVariables: {
          ENV: { value: env },
        },
      }
    );

    const pipelineInfraAction = new codepipelineActions.CodeBuildAction({
      actionName: "meal_planner_pipeline_build_" + env,
      project: pipelineInfraBuildProject,
      input: sourceOutput,
      role: codeBuildServiceRole,
    });

    const samBuildProject = new codebuild.PipelineProject(
      this,
      "meal-planner-api-pipeline-" + env,
      {
        projectName:
          "meal-planner-api-project-" + env,
        buildSpec: codebuild.BuildSpec.fromSourceFilename(
          "buildspec-package.yml"
        ),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
        },
        role: codeBuildServiceRole,
      }
    );

    // Build actions
    // Linting and SAM packaging
    const packagingAction = new codepipelineActions.CodeBuildAction({
      actionName: "package_SAM_" + env,
      project: samBuildProject,
      input: sourceOutput,
      outputs: [packageSamOutput],
      role: codeBuildServiceRole,
    });

    const cdkBuildOutput = new codepipeline.ArtifactPath(
      packageSamOutput,
      "packaged-template.yaml"
    );

    const deploySamChangeSetAction = new codepipelineActions.CloudFormationCreateReplaceChangeSetAction(
      {
        actionName: "deploy_SAM_changeset_" + env,
        stackName: "meal-planner-api-" + env,
        templatePath: cdkBuildOutput,
        adminPermissions: true,
        changeSetName: "meal-planner-api-changeset-" + env,
        deploymentRole: cfnServiceRole,
      }
    );

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
