-- Run this query in your Supabase SQL Editor to grant admin access
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'abhishek.p@inunity.in';
