import {KeyValuePairType} from '@dapr/dapr/types/KeyValuePair.type';
import {OperationType} from '@dapr/dapr/types/Operation.type';
import {IRequestMetadata} from '@dapr/dapr/types/RequestMetadata.type';
import {StateQueryType} from '@dapr/dapr/types/state/StateQuery.type';

/**
 * The statestore interface of the data.
 * @public
 */
export interface IStateStore {
  Save: KeyValuePairType[];
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

export const Plain: IStateStore = {
  Save: [
    {
      key: 'weapon',
      value: 'DeathStar',
      etag: '1234', // some dbs don't support this
    },
    {
      key: 'planet',
      value: {
        name: 'Tatooine',
      },
    },
  ],
  Get: {
    key: 'weapon',
  },
  GetBulk: {
    keys: ['weapon', 'planet'],
    parallelism: 10,
  },
  Delete: {
    key: 'weapon',
  },
  Transaction: {
    operations: [
      {
        operation: 'delete',
        request: {
          key: 'planet',
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
      {
        operation: 'upsert',
        request: {
          key: '5',
          value: {
            person: {
              org: 'Hardware',
              id: 1007,
            },
            city: 'Los Angeles',
            state: 'CA',
          },
        },
      },
      {
        operation: 'upsert',
        request: {
          key: '3',
          value: {
            person: {
              org: 'Finance',
              id: 1071,
            },
            city: 'Sacramento',
            state: 'CA',
          },
        },
      },
    ],
  },
  Query: {
    query: {
      filter: {
        EQ: {state: 'CA'},
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
