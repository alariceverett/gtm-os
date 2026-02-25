-- Create profiles table in production

-- First create the table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    is_employee boolean DEFAULT false,
    role text DEFAULT 'user',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Service role full access"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_employee, role, created_at, updated_at)
  VALUES (
    NEW.id, 
    NEW.email,
    CASE WHEN NEW.email LIKE '%@adzeta.io' THEN true ELSE false END,
    CASE WHEN NEW.email LIKE '%@adzeta.io' THEN 'admin' ELSE 'user' END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Now insert your profile
INSERT INTO public.profiles (id, email, is_employee, role, created_at, updated_at)
VALUES (
    '197d48c7-2d63-42c0-b55b-d678021ba50c'::uuid,
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

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT * FROM public.profiles WHERE email = 'jim.kernan@adzeta.io';
