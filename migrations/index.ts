import * as migration_20261106_035643_initial from './20261106_035643_initial';
import * as migration_20261106_073918_blob_storage_fields from './20261106_073918_blob_storage_fields';

export const migrations = [
  {
    up: migration_20261106_035643_initial.up,
    down: migration_20261106_035643_initial.down,
    name: '20261106_035643_initial',
  },
  {
    up: migration_20261106_073918_blob_storage_fields.up,
    down: migration_20261106_073918_blob_storage_fields.down,
    name: '20261106_073918_blob_storage_fields'
  },
];
