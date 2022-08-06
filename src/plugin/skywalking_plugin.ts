import {Plugin, TraceConfig} from '../openfunction/function_context';

import {ContextCarrier} from 'skywalking-backend-js/lib/trace/context/ContextCarrier';
import {SpanLayer} from 'skywalking-backend-js/lib/proto/language-agent/Tracing_pb';
import {Component} from 'skywalking-backend-js/lib/trace/Component';
import {Tag} from 'skywalking-backend-js/lib/Tag';
// import agent from 'skywalking-backend-js';
import {OpenFunctionRuntime} from '../functions';
import SpanContext from 'skywalking-backend-js/lib/trace/context/SpanContext';

import config, {
  AgentConfig,
  finalizeConfig,
} from 'skywalking-backend-js/lib/config/AgentConfig';
import Protocol from 'skywalking-backend-js/lib/agent/protocol/Protocol';
import GrpcProtocol from 'skywalking-backend-js/lib/agent/protocol/grpc/GrpcProtocol';
import {forEach, map} from 'lodash';

const spanContext = 'spanContext';
const spanItem = 'span';

class Agent {
  private started = false;
  private protocol: Protocol | null = null;

  start(options: AgentConfig = {}): void {
    if (process.env.SW_DISABLE === 'true') {
      console.info('SkyWalking agent is disabled by `SW_DISABLE=true`');
      return;
    }

    if (this.started) {
      console.warn(
        'SkyWalking agent started more than once, subsequent options to start ignored.'
      );
      return;
    }

    Object.assign(config, options);
    finalizeConfig(config);

    console.debug('Starting SkyWalking agent');

    // new PluginInstaller().install();

    this.protocol = new GrpcProtocol().heartbeat().report();
    this.started = true;
  }

  flush(): Promise<any> | null {
    if (this.protocol === null) {
      console.warn('Trying to flush() SkyWalking agent which is not started.');
      return null;
    }

    return this.protocol.flush();
  }
}

const agent = new Agent();

export class SkywalkingPlugin extends Plugin {
  static Name = 'skywalking';
  static Version = 'v1';

  private ofn_plugin_name: string;
  private ofn_plugin_version: string;

  private traceConfig: TraceConfig;
  private func: string;
  private layer: string;
  private tags: Array<Tag> = [];

  constructor(traceConfig: TraceConfig) {
    super();
    this.traceConfig = traceConfig;
    this.ofn_plugin_name = SkywalkingPlugin.Name;
    this.ofn_plugin_version = SkywalkingPlugin.Version;

    map(this.traceConfig.tags, (k, v) => {
      if (k !== 'func' && k !== 'layer') {
        this.tags.push({key: k, val: v, overridable: false});
      }
    });
    this.func = this.traceConfig.tags['func'] || 'default';
    this.layer = this.traceConfig.tags['layer'] || 'faas';
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
    const temp: any = ctx;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trace: any = {};
    const carrier = ContextCarrier.from({});
    const context = new SpanContext();
    const span = context.newEntrySpan('/dapr' + new Date().getTime(), carrier);
    forEach(this.tags, tag => {
      span.tag(tag);
    });
    span.layer = SpanLayer.FAAS;
    span.component = Component.UNKNOWN;
    span.start();
    span.async();

    // // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trace[spanContext] = context;
    trace[spanItem] = span;
    temp.trace = trace;
  }

  public async execPostHook(ctx?: OpenFunctionRuntime | undefined) {
    if (!ctx) {
      console.error('ctx is undefined');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const temp: any = ctx;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trace: any = temp.trace;
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
