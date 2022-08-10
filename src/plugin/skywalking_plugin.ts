import {
  OpenFunctionContext,
  Plugin,
  RuntimeType,
  TraceConfig,
} from '../openfunction/function_context';

import {ContextCarrier} from 'skywalking-backend-js/lib/trace/context/ContextCarrier';
import {SpanLayer} from 'skywalking-backend-js/lib/proto/language-agent/Tracing_pb';
import {Component} from 'skywalking-backend-js/lib/trace/Component';
import {Tag} from 'skywalking-backend-js/lib/Tag';
// import agent from 'skywalking-backend-js';
import {OpenFunctionRuntime} from '../functions';
import SpanContext from 'skywalking-backend-js/lib/trace/context/SpanContext';

import agent from 'skywalking-backend-js';
import {forEach, map} from 'lodash';

const spanContext = 'spanContext';
const spanItem = 'span';

// https://github.com/apache/skywalking/blob/master/oap-server/server-starter/src/main/resources/component-libraries.yml#L515
const componentIDOpenFunction = new Component(5013);

export class SkywalkingPlugin extends Plugin {
  static Name = 'skywalking';
  static Version = 'v1';

  private ofn_plugin_name: string;
  private ofn_plugin_version: string;

  private readonly context: OpenFunctionContext;

  private traceConfig: TraceConfig;
  private func = 'default';
  private layer = 'faas';
  private tags: Array<Tag> = [];

  constructor(context: OpenFunctionContext) {
    super();
    this.context = context;

    this.traceConfig = context.tracing!;
    this.ofn_plugin_name = SkywalkingPlugin.Name;
    this.ofn_plugin_version = SkywalkingPlugin.Version;

    map(this.traceConfig.tags, (k, v) => {
      if (k === 'func') {
        this.func = v;
      } else if (v === 'layer') {
        this.layer = v;
      } else {
        this.tags.push({key: k, val: v, overridable: false});
      }
    });
  }

  public start() {
    console.info(
      `start skywalking agent oapServer ${this.traceConfig.provider.oapServer}`
    );

    agent.start({
      serviceName: this.func,
      serviceInstance: `${this.func}-instance`,
      collectorAddress: this.traceConfig.provider.oapServer,
    });
  }

  public async execPreHook(ctx?: OpenFunctionRuntime | undefined) {
    if (!ctx) {
      console.error('ctx is undefined');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyCtx: any = ctx;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trace: any = {};

    let carrier: ContextCarrier | undefined;
    if (this.context.runtime === RuntimeType.Async) {
      // TODO daprv.2.0 will add metadata option to pubsub and subscribe
      carrier = ContextCarrier.from({});
    } else if (this.context.runtime === RuntimeType.Knative) {
      // TODO
    }

    const context = new SpanContext();
    const span = context.newEntrySpan(`/openfunction-${this.func}`, carrier);

    forEach(this.tags, tag => {
      span.tag(tag);
    });
    span.layer = SpanLayer.FAAS;
    span.component = componentIDOpenFunction;
    span.tag({
      key: 'runtimeType',
      val: this.context.runtime,
      overridable: false,
    });
    span.start();
    span.async();

    // // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trace[spanContext] = context;
    trace[spanItem] = span;
    anyCtx.trace = trace;
  }

  public async execPostHook(ctx?: OpenFunctionRuntime | undefined) {
    if (!ctx) {
      console.error('ctx is undefined');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyCtx: any = ctx;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trace: any = anyCtx.trace;
    trace[spanItem].stop();
    trace[spanContext].stop(trace['span']);
    await agent.flush();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get(filedName: string): any {
    for (const key in this) {
      if (key === filedName) {
        return this[key];
      }
    }
  }
}
