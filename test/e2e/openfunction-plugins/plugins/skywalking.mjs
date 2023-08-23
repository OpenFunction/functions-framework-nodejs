import { GraphQLClient, gql } from 'graphql-request';

import { Plugin } from '../../../../build/src/index.js';

export class SkyPathfinder extends Plugin {
  span = {};

  constructor() {
    super('sky-pathfinder', 'v1');
  }

  async execPostHook(ctx) {
    // Wait a while for trace logging
    await new Promise(r => setTimeout(r, 1000));

    const traceId = ctx.locals.traceId;
    const { trace } = await this.queryGraph(traceId);

    this.span = trace.spans[0];

    // console.log('[ span ] >', ctx.locals.traceId, this.span);
    delete this.span.traceId;
    console.log(JSON.stringify(this.span));
  }

  async queryGraph(traceId, endpoint = 'http://localhost:12800/graphql') {
    const client = new GraphQLClient(endpoint, {
      headers: {
        // Why need this header? https://github.com/prisma-labs/graphql-request/issues/140
        accept: 'application/json',
      },
    });

    // Spec: https://github.com/apache/skywalking-query-protocol/blob/master/trace.graphqls
    const query = gql`
      query ($traceId: ID!) {
        trace: queryTrace(traceId: $traceId) {
          spans {
            traceId
            endpointName
            type
            component
            layer
            isError
            tags {
              key
              value
            }
          }
        }
      }
    `;

    const data = await client.request(query, { traceId });
    return data;
  }
}
