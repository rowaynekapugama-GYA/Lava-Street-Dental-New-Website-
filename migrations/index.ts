import * as migration_20261106_035643_initial from './20261106_035643_initial';
import * as migration_20261106_073918_blob_storage_fields from './20261106_073918_blob_storage_fields';
import * as migration_20261111_023444_gtm_container_id from './20261111_023444_gtm_container_id';
import * as migration_20261124_011407_booking_and_email_switches from './20261124_011407_booking_and_email_switches';

export const migrations = [
  {
    up: migration_20261106_035643_initial.up,
    down: migration_20261106_035643_initial.down,
    name: '20261106_035643_initial',
  },
  {
    up: migration_20261106_073918_blob_storage_fields.up,
    down: migration_20261106_073918_blob_storage_fields.down,
    name: '20261106_073918_blob_storage_fields',
  },
  {
    up: migration_20261111_023444_gtm_container_id.up,
    down: migration_20261111_023444_gtm_container_id.down,
    name: '20261111_023444_gtm_container_id',
  },
  {
    up: migration_20261124_011407_booking_and_email_switches.up,
    down: migration_20261124_011407_booking_and_email_switches.down,
    name: '20261124_011407_booking_and_email_switches'
  },
];
