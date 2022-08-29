export enum SystemInfoItem {
  RuntimeType = 'RuntimeType',
  FunctionName = 'FunctionName',
  Instance = 'OpenfunctionInstance',
}

const systemInfoStore: Record<SystemInfoItem, string> = {
  [SystemInfoItem.RuntimeType]: 'knative',
  [SystemInfoItem.FunctionName]: 'function',
  [SystemInfoItem.Instance]: 'OpenfunctionInstance',
};

export {systemInfoStore};
