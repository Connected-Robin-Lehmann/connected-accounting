-- Add invoice_document_id to payments table
ALTER TABLE public.payments 
ADD COLUMN invoice_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX idx_payments_invoice_document ON public.payments(invoice_document_id);