import { z } from 'zod';

// Phone number validation (Indian format - accepts 10 digits, with optional leading 0, 91, or +91)
// Also strips spaces, dashes, and dots before validation
const phoneRegex = /^(?:(?:\+91|91|0)?[6-9]\d{9})$/;

// Helper to clean phone number before validation
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[\s\-\.]/g, '');
}

// Name validation - allows letters, spaces, and common Indian name characters
const nameRegex = /^[a-zA-Z\s\u0900-\u097F]+$/;

// Email validation
export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Invalid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

// Password validation
export const passwordSchema = z
  .string()
  .min(6, { message: "Password must be at least 6 characters" })
  .max(72, { message: "Password must be less than 72 characters" });

// Phone validation - cleans the number before validating
export const phoneSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[\s\-\.]/g, ''))
  .refine((val) => phoneRegex.test(val), { message: "Enter a valid 10-digit phone number (e.g., 9876543210)" });

// Name validation
export const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "Name must be at least 2 characters" })
  .max(100, { message: "Name must be less than 100 characters" })
  .regex(nameRegex, { message: "Name can only contain letters and spaces" });

// Age validation
export const ageSchema = z
  .number()
  .min(5, { message: "Age must be at least 5" })
  .max(25, { message: "Age must be at most 25" });

// District/State validation
export const locationSchema = z
  .string()
  .trim()
  .min(2, { message: "Must be at least 2 characters" })
  .max(100, { message: "Must be less than 100 characters" });

// Board type enum
export const boardSchema = z.string().trim().min(1, { message: "Please select a board" });

// Class validation
export const classSchema = z
  .string()
  .trim()
  .min(1, { message: "Please select a class" });

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Password is required" }),
});

// Signup form schema
export const signupSchema = z.object({
  fullName: nameSchema,
  phone: phoneSchema,
  parentWhatsapp: phoneSchema,
  class: classSchema,
  age: z.string().min(1, { message: "Age is required" }),
  board: boardSchema,
  district: locationSchema,
  state: locationSchema,
  email: emailSchema,
  password: passwordSchema,
});

// Chat message validation
export const chatMessageSchema = z
  .string()
  .trim()
  .min(1, { message: "Message cannot be empty" })
  .max(4000, { message: "Message must be less than 4000 characters" });

// Topic validation
export const topicSchema = z
  .string()
  .trim()
  .min(1, { message: "Topic is required" })
  .max(200, { message: "Topic must be less than 200 characters" });

// Validation helper function
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = err.message;
    }
  });
  
  return { success: false, errors };
}

// Sanitize text input for display
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
}

// Encode for URL parameters
export function encodeForUrl(text: string): string {
  return encodeURIComponent(text.trim());
}
