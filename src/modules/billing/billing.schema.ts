// src/modules/billing/billing.schema.ts

import { z } from 'zod';

export const billingSchema = {
  createOrder: z.object({
    body: z.object({
      planKey: z.string().min(1, 'Plan key is required'),
      billingCycle: z.enum(['monthly', 'yearly']).optional().default('monthly'),
      couponCode: z.string().max(32).optional(),
    })
  }),

  couponPreview: z.object({
    body: z.object({
      planKey: z.string().min(1, 'Plan key is required'),
      couponCode: z.string().min(1, 'Enter a coupon code').max(32),
    })
  }),

  verifyPayment: z.object({
    body: z.object({
      razorpay_order_id: z.string().min(1, 'Order ID is required'),
      razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
      razorpay_signature: z.string().min(1, 'Signature is required')
    })
  }),

  upgrade: z.object({
    body: z.object({
      planType: z.string().min(1, 'Plan type is required'),
      billingCycle: z.enum(['monthly', 'yearly']).optional().default('monthly')
    })
  })
};