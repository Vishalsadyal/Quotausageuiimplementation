import { z } from "zod";
import { PAID_PLANS } from "src/lib/plans";

export const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());
export const passwordSchema = z.string().min(8).max(128);

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().trim().min(6).max(30),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  role: z.enum(["user", "admin"]).default("user"),
});

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const otpSendSchema = z.object({
  email: emailSchema,
  purpose: z.enum(["signup", "login", "password_reset"]).default("signup"),
});

export const otpVerifySchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/),
  purpose: z.enum(["signup", "login", "password_reset"]).default("signup"),
});

export const otpLoginSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/),
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/),
  password: passwordSchema,
});

export const consentSchema = z.object({
  consentType: z.enum(["auto_apply_terms", "communication_opt_in"]),
  version: z.string().trim().min(1).max(32),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatar: z.string().trim().url().optional().nullable(),
});

export const createJobSchema = z.object({
  criteria: z.record(z.string(), z.any()),
  profileSnapshot: z.record(z.string(), z.any()).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

export const cancelJobSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const checkoutSchema = z.object({
  plan: z.enum(PAID_PLANS),
  discountCode: z.string().trim().max(32).optional(),
});

export const onboardingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(30),
  currentCity: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => String(value ?? "").trim()),
  addressLine: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => String(value ?? "").trim()),
  linkedinUrl: z
    .union([z.string().trim().url(), z.literal("")])
    .optional()
    .transform((value) => String(value ?? "").trim()),
  portfolioUrl: z
    .union([z.string().trim().url(), z.literal("")])
    .optional()
    .transform((value) => String(value ?? "").trim()),
});
