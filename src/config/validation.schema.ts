import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(8080),
  SONIOX_API_KEY: Joi.string().required(),
  OPENROUTER_API_KEY: Joi.string().required(),
  TRANSLATION_LOCATION: Joi.string().default('global'),
  TRANSLATION_DEFAULT_TARGET_LANG: Joi.string().default('en'),
  ALLOWED_ORIGINS: Joi.string().required(),
});
