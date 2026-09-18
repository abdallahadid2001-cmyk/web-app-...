ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.products RENAME COLUMN sku TO barcode;