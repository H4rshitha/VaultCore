import Joi from 'joi';

export const createPaymentSchema = Joi.object({
  idempotencyKey: Joi.string().uuid().required(),
  sourceAccountNumber: Joi.string().required(),
  targetAccountNumber: Joi.string().disallow(Joi.ref('sourceAccountNumber')).required(),
  amount: Joi.number().positive().precision(2).required(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  description: Joi.string().max(255).optional(),
});

export const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const details = error.details.map((d) => d.message);
    return res.status(400).json({
      success: false,
      error: { message: 'Validation error', details },
    });
  }
  req.body = value;
  next();
};
