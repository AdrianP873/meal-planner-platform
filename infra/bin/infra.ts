#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { EnvProps, PipelineAPI } from '../src/lib/pipeline_build';

const app = new cdk.App();

//new InfraStack(app, 'InfraStack');
new PipelineAPI(app, 'staging');
