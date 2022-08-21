import {CloudEvent} from '../../../src';

export interface IPayload {
  RAW: object;
  CE?: CloudEvent<Object>;
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
