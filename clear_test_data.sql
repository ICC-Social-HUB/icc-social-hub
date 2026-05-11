-- SQL Script to clear testing data for a fresh feature launch
-- WARNING: This will delete ALL attendance records and inventory requests.

-- 1. Clear all attendance data
DELETE FROM public.attendance;

-- 2. Clear all inventory requests
DELETE FROM public.inventory_requests;

-- 3. Reset available_stock to total_stock for all inventory items
-- This ensures that items previously marked as 'taken' are returned to the pool
UPDATE public.inventory
SET available_stock = total_stock;

-- Optional: If you want to clear notifications related to these features
-- DELETE FROM public.notifications WHERE body LIKE 'inventory_%';
