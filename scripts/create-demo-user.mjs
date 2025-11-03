import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  DEMO_EMAIL = 'demo@email',
  DEMO_PASSWORD = 'demo@pass',
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
      'Retrieve them from your Supabase dashboard and try again.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

try {
  const { data: existingUser, error: getUserError } = await supabase.auth.admin.getUserByEmail(
    DEMO_EMAIL
  );

  if (getUserError && getUserError.message !== 'User not found') {
    throw getUserError;
  }

  let userId = existingUser?.user?.id;

  if (!userId) {
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });

    if (createUserError) {
      throw createUserError;
    }

    userId = createdUser?.user?.id ?? null;
  }

  if (!userId) {
    throw new Error('Unable to resolve demo user ID after create/get operations.');
  }

  const { error: upsertError } = await supabase.from('user_profiles').upsert({
    id: userId,
    full_name: 'Demo User',
    email: DEMO_EMAIL,
    preferred_channel: 'email',
  });

  if (upsertError) {
    throw upsertError;
  }

  console.log(
    `Demo credentials ready. Email: ${DEMO_EMAIL}, Password: ${DEMO_PASSWORD}. You can now log in with these details.`
  );
  process.exit(0);
} catch (error) {
  console.error('Failed to provision demo credentials:', error);
  process.exit(1);
}
