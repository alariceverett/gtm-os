-- PRODUCTION FIX: Create profile for authenticated user
-- Run this in Supabase Dashboard SQL Editor

-- Insert or update profile for jim.kernan@adzeta.io
-- Replace the UUID with the actual user ID from your auth session
INSERT INTO public.profiles (id, email, is_employee, role, created_at, updated_at)
VALUES (
    '197d48c7-2d63-42c0-b55b-d678021ba50c'::uuid,  -- Replace with actual user ID from auth.users
    'jim.kernan@adzeta.io',
    true,
    'admin',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE 
SET 
    is_employee = true, 
    role = 'admin',
    updated_at = NOW();

-- Verify the insert
SELECT id, email, is_employee, role 
FROM public.profiles 
WHERE email = 'jim.kernan@adzeta.io';

-- To find the correct user ID, run:
-- SELECT id, email FROM auth.users WHERE email = 'jim.kernan@adzeta.io';
