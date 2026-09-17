import Joi from 'joi';

const entrySchema = Joi.object({
  accountNumber: Joi.string().required(),
  type: Joi.string().valid('DEBIT', 'CREDIT').required(),
  amount: Joi.number().positive().precision(2).required(),
});

export const createJournalSchema = Joi.object({
  referenceId: Joi.string().required(),
  description: Joi.string().required(),
  entries: Joi.array().items(entrySchema).min(2).required(),
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
