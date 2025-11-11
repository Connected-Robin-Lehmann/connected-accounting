-- Make client_id nullable in documents table to support expense invoices
ALTER TABLE documents 
ALTER COLUMN client_id DROP NOT NULL;

-- Update category to distinguish expense documents
UPDATE documents 
SET category = 'Expense' 
WHERE client_id IS NULL AND category = 'Invoice';