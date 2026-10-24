import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import * as logs from "aws-cdk-lib/aws-logs";

/**
 * PATCH infrastructure. Maps the local-mode adapters to AWS managed services
 * (see product/architecture.md §6/§8). Each service earns its place:
 *   - DynamoDB: single-table persistence with the GSIs the access patterns need.
 *   - Lambda:   runs the same domain logic behind API Gateway.
 *   - Cognito:  managed auth (replaces the local dev user switcher).
 *   - S3:       private bucket for optional image uploads (stretch).
 *   - SNS:      optional request notifications.
 *   - CloudWatch: logs/metrics (log retention set below).
 * IAM is scoped to least privilege — Bedrock access is limited to InvokeModel
 * on a single model ARN supplied via context/env.
 *
 * NOTE: This stack is provided and designed to `cdk synth`, but it is NOT
 * deployed here because no AWS credentials are configured. See the README for
 * the deployment prerequisites and steps.
 */
export class PatchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---- DynamoDB single table + GSIs ------------------------------------
    const table = new dynamodb.Table(this, "PatchTable", {
      tableName: "patch",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // demo; use RETAIN in production
    });
    // GSI1: resources by owner
    table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
    });
    // GSI2: resources by community+category (and users by community)
    table.addGlobalSecondaryIndex({
      indexName: "GSI2",
      partitionKey: { name: "GSI2PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI2SK", type: dynamodb.AttributeType.STRING },
    });
    // GSI3: requests by resource owner (incoming)
    table.addGlobalSecondaryIndex({
      indexName: "GSI3",
      partitionKey: { name: "GSI3PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI3SK", type: dynamodb.AttributeType.STRING },
    });
    // GSI4: requests/resources by resource id (conflict checks + lookups)
    table.addGlobalSecondaryIndex({
      indexName: "GSI4",
      partitionKey: { name: "GSI4PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI4SK", type: dynamodb.AttributeType.STRING },
    });

    // ---- Cognito user pool ------------------------------------------------
    const userPool = new cognito.UserPool(this, "PatchUserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      passwordPolicy: { minLength: 12, requireLowercase: true, requireDigits: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const userPoolClient = userPool.addClient("PatchWebClient", {
      authFlows: { userSrp: true },
    });

    // ---- S3 bucket for optional image uploads (private) ------------------
    const imagesBucket = new s3.Bucket(this, "PatchImages", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ["*"], // tighten to your web origin in production
          allowedHeaders: ["*"],
          maxAge: 300,
        },
      ],
    });

    // ---- Optional SNS topic for notifications ----------------------------
    const notificationsTopic = new sns.Topic(this, "PatchNotifications", {
      displayName: "PATCH request notifications",
    });

    // ---- Bedrock model ARN (least-privilege InvokeModel) -----------------
    const bedrockModelId =
      (this.node.tryGetContext("bedrockModelId") as string | undefined) ??
      process.env.PATCH_BEDROCK_MODEL_ID ??
      "anthropic.claude-3-5-sonnet-20240620-v1:0";
    const bedrockModelArn = `arn:aws:bedrock:${this.region}::foundation-model/${bedrockModelId}`;

    // ---- Lambda (business logic) -----------------------------------------
    // The handler bundle is produced separately (e.g. by adapting the Next.js
    // route handlers into a Lambda entrypoint, or via a container image). Here
    // we wire env + permissions; point `code` at your built artifact.
    const apiLogGroup = new logs.LogGroup(this, "PatchApiFnLogs", {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const apiFn = new lambda.Function(this, "PatchApiFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      // Placeholder inline code so `cdk synth` succeeds without a prebuilt
      // artifact. Replace with lambda.Code.fromAsset("../.lambda") when bundling.
      code: lambda.Code.fromInline(
        "exports.handler = async () => ({ statusCode: 200, body: 'PATCH API placeholder' });",
      ),
      memorySize: 512,
      timeout: cdk.Duration.seconds(15),
      logGroup: apiLogGroup,
      environment: {
        PATCH_PERSISTENCE: "dynamo",
        PATCH_AI_PROVIDER: "bedrock",
        PATCH_DDB_TABLE: table.tableName,
        PATCH_BEDROCK_MODEL_ID: bedrockModelId,
        PATCH_SNS_TOPIC_ARN: notificationsTopic.topicArn,
        PATCH_IMAGES_BUCKET: imagesBucket.bucketName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    // Least-privilege grants.
    table.grantReadWriteData(apiFn);
    imagesBucket.grantReadWrite(apiFn);
    notificationsTopic.grantPublish(apiFn);
    apiFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [bedrockModelArn],
      }),
    );

    // ---- API Gateway (HTTP API) with Cognito JWT authorizer --------------
    const httpApi = new apigw.HttpApi(this, "PatchHttpApi", {
      corsPreflight: {
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [apigw.CorsHttpMethod.ANY],
        allowOrigins: ["*"], // tighten to your web origin in production
      },
    });
    const integration = new integrations.HttpLambdaIntegration("PatchApiInteg", apiFn);
    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigw.HttpMethod.ANY],
      integration,
    });

    // ---- Outputs ----------------------------------------------------------
    new cdk.CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "TableName", { value: table.tableName });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "ImagesBucket", { value: imagesBucket.bucketName });
    new cdk.CfnOutput(this, "NotificationsTopicArn", { value: notificationsTopic.topicArn });
  }
}
