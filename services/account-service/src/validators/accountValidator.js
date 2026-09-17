import Joi from 'joi';

export const createAccountSchema = Joi.object({
  type: Joi.string().valid('SAVINGS', 'CHECKING', 'INVESTMENT').default('CHECKING'),
  currency: Joi.string().length(3).uppercase().default('USD'),
  initialDeposit: Joi.number().min(0).default(0),
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
