/**
 * Request schemas for the auth module.
 *
 * Re-exported from `@connected/types` rather than defined here: the web app validates its forms
 * against these same schemas, so a change to a rule reaches both sides at once. Defining them
 * twice is how a client and server drift.
 */
export {
  loginSchema,
  refreshSchema,
  registerIndividualSchema,
  registerSchoolSchema,
  type LoginInput,
  type RegisterIndividualInput,
  type RegisterSchoolInput,
} from '@connected/types';
