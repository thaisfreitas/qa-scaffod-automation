import { z } from "zod";

export const apiMessageSchema = z.object({
  responseCode: z.number(),
  message: z.string(),
});

export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.string(),
  brand: z.string(),
  category: z.object({
    usertype: z.object({
      usertype: z.string(),
    }),
    category: z.string(),
  }),
});

export const productsListSchema = z.object({
  responseCode: z.literal(200),
  products: z.array(productSchema),
});

export const createAccountInputSchema = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
  title: z.string(),
  birth_date: z.string(),
  birth_month: z.string(),
  birth_year: z.string(),
  firstname: z.string(),
  lastname: z.string(),
  company: z.string(),
  address1: z.string(),
  address2: z.string(),
  country: z.string(),
  zipcode: z.string(),
  state: z.string(),
  city: z.string(),
  mobile_number: z.string(),
});

export type ApiMessage = z.infer<typeof apiMessageSchema>;
export type Product = z.infer<typeof productSchema>;
export type ProductsList = z.infer<typeof productsListSchema>;
export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;
