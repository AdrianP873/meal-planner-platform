#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { InfraStack } from '../lib/infra-stack';
import { EnvProps, PipelineAPI } from '../lib/pipeline_build';

const app = new cdk.App();


//new InfraStack(app, 'InfraStack');
new PipelineAPI(app, 'staging');
