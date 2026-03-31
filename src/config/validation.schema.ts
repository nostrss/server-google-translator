import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(8080),
  SONIOX_API_KEY: Joi.string().required(),
  GOOGLE_PROJECT_ID: Joi.string().required(),
  GOOGLE_CLIENT_EMAIL: Joi.string().required(),
  GOOGLE_PRIVATE_KEY: Joi.string().required(),
  TRANSLATION_LOCATION: Joi.string().default('global'),
  TRANSLATION_DEFAULT_TARGET_LANG: Joi.string().default('en'),
  ALLOWED_ORIGINS: Joi.string().required(),
});
