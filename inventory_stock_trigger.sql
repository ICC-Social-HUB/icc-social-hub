-- SQL Script to automate inventory stock updates
-- Ensures available_stock is always accurate when items are borrowed or returned

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_inventory_stock_change()
RETURNS TRIGGER AS $$
BEGIN
    -- CASE: Item is MARKED AS TAKEN (Borrowed)
    -- This decreases available stock
    IF (TG_OP = 'UPDATE' AND OLD.status != 'taken' AND NEW.status = 'taken') THEN
        UPDATE public.inventory
        SET available_stock = GREATEST(0, available_stock - NEW.quantity),
            updated_at = now()
        WHERE id = NEW.item_id;
    
    -- CASE: Item is RETURNED or a 'Taken' status is UNDONE (Completed/Cancelled)
    -- This increases available stock
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'taken' AND NEW.status != 'taken') THEN
        UPDATE public.inventory
        SET available_stock = LEAST(total_stock, available_stock + OLD.quantity),
            updated_at = now()
        WHERE id = OLD.item_id;

    -- CASE: A 'Taken' request is DELETED (Mistake cleanup)
    ELSIF (TG_OP = 'DELETE' AND OLD.status = 'taken') THEN
        UPDATE public.inventory
        SET available_stock = LEAST(total_stock, available_stock + OLD.quantity),
            updated_at = now()
        WHERE id = OLD.item_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS tr_inventory_stock_sync ON public.inventory_requests;
CREATE TRIGGER tr_inventory_stock_sync
AFTER UPDATE OR DELETE ON public.inventory_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_inventory_stock_change();

-- 3. Safety check: Ensure available_stock never exceeds total_stock
ALTER TABLE public.inventory 
ADD CONSTRAINT check_available_stock_limits 
CHECK (available_stock <= total_stock AND available_stock >= 0);
