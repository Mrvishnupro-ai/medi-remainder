-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create the cron job
-- NOTE: You must replace 'YOUR_SERVICE_ROLE_KEY' with your actual Supabase Service Role Key
select
  cron.schedule(
    'invoke-smooth-processor', -- name of the cron job
    '* * * * *', -- every minute
    $$
    select
      net.http_post(
          url:='https://dgjzkyhgooscezivprao.supabase.co/functions/v1/smooth-processor',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
          body:='{"mode": "scheduled"}'::jsonb
      ) as request_id;
    $$
  );
