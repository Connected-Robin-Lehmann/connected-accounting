-- Add category column to documents table
ALTER TABLE public.documents 
ADD COLUMN category text CHECK (category IN ('Invoice', 'Contract', 'Price suggestion'));