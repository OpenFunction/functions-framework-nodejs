import {forEach} from 'lodash';
import agent, {ContextManager} from 'skywalking-backend-js';
import SpanContext from 'skywalking-backend-js/lib/trace/context/SpanContext';
import {SpanLayer} from 'skywalking-backend-js/lib/proto/language-agent/Tracing_pb';
import {Component} from 'skywalking-backend-js/lib/trace/Component';
import {Tag} from 'skywalking-backend-js/lib/Tag';
import Span from 'skywalking-backend-js/lib/trace/span/Span';
import Context from 'skywalking-backend-js/lib/trace/context/Context';

import {Plugin} from '../../plugin';
import {OpenFunctionRuntime} from '../../runtime';
import {TraceConfig} from '../../context';
import {SystemInfoItem, systemInfoStore} from '../../system_info';

// https://github.com/apache/skywalking/blob/master/oap-server/server-starter/src/main/resources/component-libraries.yml#L515
const componentIDOpenFunction = new Component(5013);

export const SKYWALKINGNAME = 'skywalking';

class Trace {
  private span: Span;
  private spanContext: Context;

  constructor() {
    this.spanContext = ContextManager.hasContext
      ? ContextManager.current
      : new SpanContext();

    this.span = this.spanContext.newEntrySpan(
      `/${systemInfoStore[SystemInfoItem.FunctionName]}`,
      undefined
    );
  }

  async start(tags: Array<Tag>) {
    forEach(tags, tag => {
      this.span.tag(tag);
    });
    this.span.layer = SpanLayer.FAAS;
    this.span.component = componentIDOpenFunction;
    this.span.start();
    this.span.async();
  }

  async stop() {
    this.span.stop();
    this.spanContext.stop(this.span);
    await agent.flush();
  }
}

/**
 * Defining an  class to provide trace ability alugin by skywalking .
 * @public
 **/
export class SkyWalkingPlugin extends Plugin {
  private trace: Trace | undefined;
  private tags: Array<Tag> = [];

  constructor(traceConfig: TraceConfig) {
    super(SKYWALKINGNAME, 'v1');

    // Start skywalking agent
    agent.start({
      serviceName: systemInfoStore[SystemInfoItem.FunctionName],
      serviceInstance: systemInfoStore[SystemInfoItem.Instance],
      collectorAddress: traceConfig.provider?.oapServer,
    });

    this.iniAttribute(traceConfig);
  }

  iniAttribute(traceConfig: TraceConfig) {
    traceConfig.tags[SystemInfoItem.RuntimeType] =
      systemInfoStore[SystemInfoItem.RuntimeType];
    for (const key in traceConfig.tags) {
      this.tags.push({
        key,
        val: traceConfig.tags[key],
        overridable: false,
      });
    }
  }

  async execPreHook(
    ctx: OpenFunctionRuntime | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    plugins: Record<string, Plugin>
  ) {
    if (ctx === null) {
      console.warn('OpenFunctionRuntime [ctx] is null');
    }
    this.trace = new Trace();
    await this.trace.start(this.tags);
  }

  async execPostHook(
    ctx: OpenFunctionRuntime | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    plugins: Record<string, Plugin>
  ) {
    if (ctx === null) {
      console.warn('OpenFunctionRuntime [ctx] is null');
    }
    await this.trace?.stop();
  }
}
