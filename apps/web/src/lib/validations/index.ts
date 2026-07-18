import { z } from 'zod';

// ============================================
// Common Validation Patterns
// ============================================

/**
 * Required string that cannot be empty or whitespace only
 */
export const requiredString = (fieldName: string = 'This field') =>
  z
    .string({ message: `${fieldName} is required` })
    .min(1, `${fieldName} is required`)
    .trim();

/**
 * Optional string that can be empty or undefined
 */
export const optionalString = () => z.string().optional().or(z.literal(''));

/**
 * Email validation with proper format checking
 */
export const emailSchema = z
  .string({ message: 'Email is required' })
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .toLowerCase()
  .trim();

/**
 * Password with minimum requirements
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export const passwordSchema = z
  .string({ message: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Simple password - just minimum length
 */
export const simplePasswordSchema = z
  .string({ message: 'Password is required' })
  .min(6, 'Password must be at least 6 characters');

/**
 * Phone number validation (international format)
 */
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number')
  .optional()
  .or(z.literal(''));

/**
 * URL validation
 */
export const urlSchema = z.string().url('Please enter a valid URL').optional().or(z.literal(''));

/**
 * Positive number validation
 */
export const positiveNumber = (fieldName: string = 'This field') =>
  z.number({ message: `${fieldName} must be a number` }).positive(`${fieldName} must be a positive number`);

/**
 * Non-negative number validation (zero or positive)
 */
export const nonNegativeNumber = (fieldName: string = 'This field') =>
  z.number({ message: `${fieldName} must be a number` }).nonnegative(`${fieldName} must be zero or a positive number`);

/**
 * Integer validation
 */
export const integerSchema = (fieldName: string = 'This field') =>
  z.number({ message: `${fieldName} must be a number` }).int(`${fieldName} must be a whole number`);

/**
 * Date validation (string in ISO format or Date object)
 */
export const dateSchema = z.coerce.date({
  message: 'Please enter a valid date',
});

/**
 * Future date validation
 */
export const futureDateSchema = z.coerce
  .date({ message: 'Please enter a valid date' })
  .refine((date) => date > new Date(), {
    message: 'Date must be in the future',
  });

/**
 * Past date validation
 */
export const pastDateSchema = z.coerce
  .date({ message: 'Please enter a valid date' })
  .refine((date) => date < new Date(), {
    message: 'Date must be in the past',
  });

/**
 * Boolean with required true (for terms acceptance, etc.)
 */
export const requiredBoolean = (message: string = 'This field is required') =>
  z.boolean().refine((val) => val === true, { message });

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Slug validation (lowercase letters, numbers, and hyphens)
 */
export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers, and hyphens');

/**
 * Username validation (alphanumeric with underscores)
 */
export const usernameSchema = z
  .string({ message: 'Username is required' })
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

// ============================================
// Common Form Schemas
// ============================================

/**
 * Login form schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: simplePasswordSchema,
  rememberMe: z.boolean().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Registration form schema
 */
export const registerSchema = z
  .object({
    name: requiredString('Name'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Password reset request schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Password reset schema
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * Profile update schema
 */
export const profileSchema = z.object({
  name: requiredString('Name'),
  email: emailSchema,
  phone: phoneSchema,
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

// ============================================
// Utility Functions
// ============================================

/**
 * Creates a schema for a select/dropdown field with predefined options
 */
export const createSelectSchema = <T extends string>(options: readonly T[], fieldName: string = 'This field') =>
  z.enum(options as [T, ...T[]], {
    message: `Please select a valid ${fieldName.toLowerCase()}`,
  });

/**
 * Creates a schema for a string with max length
 */
export const createStringSchema = (fieldName: string, maxLength: number, minLength: number = 1) =>
  z
    .string({ message: `${fieldName} is required` })
    .min(minLength, `${fieldName} must be at least ${minLength} characters`)
    .max(maxLength, `${fieldName} must be at most ${maxLength} characters`)
    .trim();

/**
 * Creates an optional string schema with max length
 */
export const createOptionalStringSchema = (maxLength: number) =>
  z.string().max(maxLength, `Must be at most ${maxLength} characters`).optional().or(z.literal(''));
