/**
 * Ambient declarations for the OPTIONAL AWS SDK packages. These are only
 * installed/used in AWS mode (PATCH_PERSISTENCE=dynamo or PATCH_AI_PROVIDER=bedrock).
 * Declaring them here lets `tsc` type-check the project in local mode without
 * requiring the packages to be installed. The adapters import them dynamically
 * at runtime, so a missing package simply means AWS mode isn't available until
 * you `npm install` the SDK (documented in the README).
 */
declare module "@aws-sdk/client-bedrock-runtime" {
  export class BedrockRuntimeClient {
    constructor(config: { region: string });
    send(command: unknown, options?: { abortSignal?: AbortSignal }): Promise<{ body: Uint8Array }>;
  }
  export class InvokeModelCommand {
    constructor(input: {
      modelId: string;
      contentType: string;
      accept: string;
      body: string;
    });
  }
}

declare module "@aws-sdk/client-dynamodb" {
  export class DynamoDBClient {
    constructor(config: { region: string });
  }
}

declare module "@aws-sdk/lib-dynamodb" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const DynamoDBDocumentClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const GetCommand: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const PutCommand: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const QueryCommand: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const TransactWriteCommand: any;
}
