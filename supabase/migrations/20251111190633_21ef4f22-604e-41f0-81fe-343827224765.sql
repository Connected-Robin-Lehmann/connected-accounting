-- Update the check constraint on documents.category to include 'Expense'
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_category_check;

ALTER TABLE documents
ADD CONSTRAINT documents_category_check 
CHECK (category IN ('Invoice', 'Contract', 'Price suggestion', 'Expense'));