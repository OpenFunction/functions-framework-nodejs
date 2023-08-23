import {CloudEvent} from '../../../src';
import {KeyValuePairType} from '@dapr/dapr/types/KeyValuePair.type';
import {OperationType} from '@dapr/dapr/types/Operation.type';
import {IRequestMetadata} from '@dapr/dapr/types/RequestMetadata.type';
import {StateQueryType} from '@dapr/dapr/types/state/StateQuery.type';

export interface IPayload {
  RAW: object;
  CE?: CloudEvent<Object>;
  State?: IStateStore;
}

interface IStateStore {
  Save: {
    dataObjects: KeyValuePairType[];
  };
  Get: {
    key: string;
  };
  GetBulk: {
    keys: string[];
    parallelism?: number;
    metadata?: string[];
  };
  Delete: {
    key: string;
  };
  Transaction: {
    operations?: OperationType[];
    metadata?: IRequestMetadata | null;
  };
  Query: {
    query: StateQueryType;
  };
}

export const Plain: IPayload = {RAW: {some: 'payload'}};

Plain.CE = {
  specversion: '1.0',
  id: 'test-1234-1234',
  type: 'ce.openfunction',
  time: '2020-05-13T01:23:45Z',
  subject: 'test-subject',
  source: 'https://github.com/OpenFunction/functions-framework-nodejs',
  datacontenttype: 'application/json',
  data: Plain.RAW,
};

Plain.State = {
  Save: {
    dataObjects: [
      {
        key: '1',
        value: {
          person: {
            org: 'Dev Ops',
            id: 1036,
          },
          city: 'Seattle',
          state: 'WA',
        },
      },
      {
        key: '2',
        value: {
          person: {
            org: 'Hardware',
            id: 1028,
          },
          city: 'Portland',
          state: 'OR',
        },
      },
    ],
  },
  Get: {
    key: '1',
  },
  GetBulk: {
    keys: ['1', '2'],
    parallelism: 10,
  },
  Delete: {
    key: '1',
  },
  Transaction: {
    operations: [
      {
        operation: 'delete',
        request: {
          key: '2',
        },
      },
      {
        operation: 'upsert',
        request: {
          key: '1',
          value: {
            person: {
              org: 'Dev Ops',
              id: 1036,
            },
            city: 'Seattle',
            state: 'WA',
          },
        },
      },
    ],
  },
  Query: {
    query: {
      filter: {
        EQ: {state: 'WA'},
      },
      sort: [
        {
          key: 'person.id',
          order: 'DESC',
        },
      ],
      page: {
        limit: 2,
      },
    },
  },
};
