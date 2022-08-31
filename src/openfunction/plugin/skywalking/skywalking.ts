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
import {FrameworkOptions} from '../../../options';

// https://github.com/apache/skywalking/blob/master/oap-server/server-starter/src/main/resources/component-libraries.yml#L515
const componentIDOpenFunction = new Component(5013);

export const SKYWALKINGNAME = 'skywalking';

class Trace {
  private span: Span;
  private spanContext: Context;

  constructor(functionName: string) {
    this.spanContext = ContextManager.hasContext
      ? ContextManager.current
      : new SpanContext();

    this.span = this.spanContext.newEntrySpan(`/${functionName}`, undefined);
  }

  async start(tags: Array<Tag>): Promise<string> {
    forEach(tags, tag => {
      this.span.tag(tag);
    });
    this.span.layer = SpanLayer.FAAS;
    this.span.component = componentIDOpenFunction;
    this.span.start();
    this.span.async();
    return this.spanContext.traceId();
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
  private functionName = 'function';

  constructor(options: FrameworkOptions) {
    super(SKYWALKINGNAME, 'v1');

    this.functionName = options.target;

    // Start skywalking agent
    agent.start({
      serviceName: this.functionName,
      serviceInstance: 'openfunctionInstance',
      collectorAddress: options.context!.tracing!.provider!.oapServer,
    });

    if (!options.context!.tracing!.tags) {
      options.context!.tracing!.tags = {};
    }
    options.context!.tracing!.tags!['RuntimeType'] =
      options.context?.runtime || 'Knative';
    this.iniAttribute(options.context!.tracing!);
  }

  iniAttribute(traceConfig: TraceConfig) {
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
      return;
    }
    this.trace = new Trace(this.functionName);
    const traceId = await this.trace.start(this.tags);
    ctx.locals.traceId = traceId;
  }

  async execPostHook(
    ctx: OpenFunctionRuntime | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    plugins: Record<string, Plugin>
  ) {
    if (ctx === null) {
      console.warn('OpenFunctionRuntime [ctx] is null');
      return;
    }
    await this.trace?.stop();
  }
}
