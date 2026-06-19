-- Seed default admin account (run once; idempotent)

DO $$
DECLARE
  admin_user_id UUID;
  admin_email TEXT := 'na.kaleb@royal.edu.vn';
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = admin_email;

  IF admin_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'admin', display_name = 'Admin', email = admin_email
    WHERE id = admin_user_id;
    RETURN;
  END IF;

  admin_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    admin_user_id,
    'authenticated',
    'authenticated',
    admin_email,
    crypt('royal@123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Admin","role":"admin"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    admin_user_id,
    admin_user_id,
    format('{"sub":"%s","email":"%s"}', admin_user_id, admin_email)::jsonb,
    'email',
    admin_user_id::text,
    NOW(),
    NOW(),
    NOW()
  );

  UPDATE public.profiles
  SET role = 'admin', display_name = 'Admin', email = admin_email
  WHERE id = admin_user_id;
END $$;
