import { z } from 'zod';

export const ExchangeSchema = z.enum(['ASX', 'NASDAQ', 'NYSE', 'ARCA', 'LSE', 'SGX', 'OTC', 'SBF', 'OSE']);

export const InstrumentSchema = z.object({
  id: z.string().min(1),
  exchange: ExchangeSchema,
  currency: z.string().min(1),
  name: z.string().min(1),
});

export const PortfolioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseCurrency: z.string().min(1),
});

export const PriceQuoteSchema = z.object({
  instrumentId: z.string().min(1),
  price: z.number(),
  currency: z.string().min(1),
  previousClose: z.number(),
  marketState: z.enum(['OPEN', 'CLOSED', 'PRE', 'POST']),
  asOf: z.number(),
});

const TransactionShapeSchema = z.object({
  id: z.string().min(1),
  portfolioId: z.string().min(1),
  instrumentId: z.string().min(1),
  type: z.enum(['BUY', 'SELL', 'DIVIDEND']),
  quantity: z.number(),
  price: z.number(),
  fees: z.number().min(0),
  currency: z.string().min(1),
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tradeDate must be YYYY-MM-DD'),
  fxRateToBase: z.number().optional(),
  fxRateFlagged: z.boolean().optional(),
  note: z.string().optional(),
});

export const TransactionInputSchema = TransactionShapeSchema.superRefine((data, ctx) => {
  const today = new Date().toISOString().slice(0, 10);
  if (data.tradeDate > today) {
    ctx.addIssue({ code: 'custom', message: 'Trade date cannot be in the future', path: ['tradeDate'] });
  }

  if (data.type === 'DIVIDEND') {
    if (data.quantity !== 0) {
      ctx.addIssue({ code: 'custom', message: 'Dividend quantity must be 0', path: ['quantity'] });
    }
    if (data.price <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Dividend cash amount must be positive', path: ['price'] });
    }
  } else {
    if (data.quantity <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Quantity must be positive', path: ['quantity'] });
    }
    if (data.price <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Price must be positive', path: ['price'] });
    }
  }
});
