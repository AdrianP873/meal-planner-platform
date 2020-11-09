import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as Infra from '../lib/pipeline_build';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Infra.PipelineAPI(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
