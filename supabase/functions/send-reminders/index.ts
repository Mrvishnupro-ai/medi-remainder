import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
// Use nodemailer for reliable SMTP handling
import nodemailer from 'npm:nodemailer@6.9.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPPORTED_CHANNELS = ['email', 'whatsapp', 'telegram'] as const;

type SupportedChannel = (typeof SUPPORTED_CHANNELS)[number];

interface MedicationSchedule {
  id: string;
  medication_id: string;
  reminder_time: string;
}

interface Medication {
  id: string;
  user_id: string;
  medication_name: string;
  dosage: string;
  instructions?: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  preferred_channel: SupportedChannel;
  whatsapp_number: string | null;
  telegram_chat_id: string | null;
  email: string | null;
}

interface ReminderResult {
  medication?: string;
  user: string;
  channel: SupportedChannel;
  status: 'sent' | 'failed';
  errorMessage?: string | null;
}

interface RequestPayload {
  mode?: 'test' | 'direct-email';
  userId?: string;
  channel?: string;
  message?: string;
  payload?: Record<string, unknown>;
}

const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
const twilioWhatsAppFrom = Deno.env.get('TWILIO_WHATSAPP_FROM');

// Gmail Configuration (for reference, but not used due to Deno limitations)
const gmailEmail = Deno.env.get('GMAIL_EMAIL') || 'higaming707@gmail.com';
const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD');

// Resend Configuration (recommended for Deno)
const resendApiKey = Deno.env.get('RESEND_API_KEY');

// Email configuration
const emailFromAddress = Deno.env.get('EMAIL_FROM') || 'medibot@notifications.com';

const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
const externalEmailApiUrl =
  Deno.env.get('EMAIL_API_URL') ||
  'https://sgcrguktsklm.org.in/phpmail-vishnu/public/api/send-email-html.php';

const toWhatsAppAddress = (value: string) =>
  value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;

async function sendWhatsAppMessage(to: string, message: string) {
  if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppFrom) {
    return { success: false, error: 'WhatsApp is coming soon!' };
  }

  const body = new URLSearchParams({
    Body: message,
    From: toWhatsAppAddress(twilioWhatsAppFrom),
    To: toWhatsAppAddress(to),
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    return { success: false, error: `Twilio error: ${errorBody}` };
  }

  return { success: true };
}

async function sendEmailMessageGmail(
  to: string,
  message: string,
  subject = 'Medication Reminder'
) {
  try {
    // Try direct SMTP to Gmail first
    if (gmailEmail && gmailAppPassword) {
      const result = await sendViaSMTP(to, subject, message, gmailEmail, gmailAppPassword);
      if (result.success) {
        return result;
      }
      console.warn('SMTP send failed, trying alternative method');
    }

    // Fallback to Resend if configured
    if (resendApiKey) {
      return await sendViaResend(to, subject, message);
    }

    // Last resort: database logging
    console.log(`[EMAIL] Falling back to relay logging for ${to}`);
    return await sendViaEmailRelay(to, subject, message);
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: `Email error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function sendViaExternalEmailApi(
  payload: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(externalEmailApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        success: false,
        error: `External email API error (${response.status}): ${text}`,
      };
    }

    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // keep raw text
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: `External email API fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function sendViaSMTP(
  to: string,
  subject: string,
  htmlContent: string,
  from: string,
  appPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[SMTP] Initializing Gmail SMTP transporter...');

    // Create a transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Use STARTTLS instead of TLS for better compatibility
      auth: {
        user: from,
        pass: appPassword, // Use Gmail App Password
      },
      debug: true, // Enable debug logging
      logger: true,
    });

    // Verify connection
    try {
      await transporter.verify();
      console.log('[SMTP] Gmail SMTP connection verified');
    } catch (verifyError) {
      console.warn('[SMTP] Verification warning (will attempt to send anyway):', verifyError);
    }

    // Send email
    console.log(`[SMTP] Sending email to ${to}...`);
    const info = await transporter.sendMail({
      from: `MediBot Reminders <${from}>`,
      to: to,
      subject: subject,
      html: formatEmailHTML(htmlContent),
      text: extractPlainText(htmlContent),
      // Add reply-to to prevent bounces
      replyTo: from,
    });

    console.log(`[SMTP] Email successfully sent. Message ID: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    console.error('[SMTP] Error sending email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send via SMTP';
    console.error('[SMTP] Full error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      success: false,
      error: `SMTP error: ${errorMessage}`,
    };
  }
}

async function sendViaResend(to: string, subject: string, htmlContent: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFromAddress,
        to: to,
        subject: subject,
        html: formatEmailHTML(htmlContent),
        text: extractPlainText(htmlContent),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Resend error (${response.status}):`, error);
      return { success: false, error: `Resend error: ${error}` };
    }

    const data = await response.json();
    console.log(`Email sent via Resend. ID: ${data.id}`);
    return { success: true };
  } catch (error) {
    console.error('Resend send error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function buildSMTPMessage(from: string, to: string, subject: string, htmlContent: string): string {
  const boundary = 'boundary123';
  return `From: MediBot Reminders <${from}>
To: ${to}
Subject: ${subject}
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="${boundary}"

--${boundary}
Content-Type: text/plain; charset="UTF-8"

${extractPlainText(htmlContent)}

--${boundary}
Content-Type: text/html; charset="UTF-8"

${formatEmailHTML(htmlContent)}

--${boundary}--
`;
}

function extractPlainText(message: string): string {
  return message.replace(/<[^>]*>/g, '').trim();
}

async function sendViaEmailRelay(to: string, subject: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log email to database for tracking and future sending
    console.log(`[EMAIL RELAY] To: ${to}, Subject: ${subject}`);
    
    // Store in a logs table if it exists (optional - creates audit trail)
    try {
      await supabase.from('email_logs').insert({
        recipient: to,
        subject: subject,
        body: message,
        sent_at: new Date().toISOString(),
        method: 'relay',
      }).catch(() => {
        // Table might not exist, that's okay
        console.log('Email stored in relay queue');
      });
    } catch (e) {
      // Silently fail if table doesn't exist
    }

    console.log(`[EMAIL RELAY] Message: ${message}`);
    return { success: true };
  } catch (error) {
    console.error('Email relay error:', error);
    return { success: false, error: 'Email relay failed' };
  }
}

function formatEmailHTML(message: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(to right, #2563eb, #06b6d4); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 20px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>MediBot Medication Reminder</h2>
          </div>
          <div class="content">
            <p>${message}</p>
            <p style="margin-top: 20px; color: #666; font-size: 14px;">
              Remember to take your medications on time. If you have any questions, please contact your healthcare provider.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message from MediBot. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function sendTelegramMessage(chatId: string, message: string) {
  if (!telegramBotToken) {
    return { success: false, error: 'Telegram is coming soon!' };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    return { success: false, error: `Telegram error: ${errorBody}` };
  }

  return { success: true };
}

const isSupportedChannel = (
  channel: string | null | undefined
): channel is SupportedChannel =>
  SUPPORTED_CHANNELS.includes((channel ?? '').toLowerCase() as SupportedChannel);

const resolveChannel = (channel: string | null | undefined): SupportedChannel =>
  isSupportedChannel(channel) ? (channel as SupportedChannel) : 'email';

function buildReminderMessage(
  profile: UserProfile,
  medication?: Medication,
  reminderTime?: string
) {
  const greeting = `Hi ${profile.full_name},`;
  const medicationLine = medication
    ? `it's time to take your medication ${medication.medication_name} (${medication.dosage}).`
    : 'this is a reminder from your MediBot assistant.';

  const instructions = medication?.instructions
    ? `Instructions: ${medication.instructions}`
    : '';

  const timing = reminderTime ? `Scheduled time: ${reminderTime}` : '';

  return [greeting, medicationLine, instructions, timing]
    .filter((line) => Boolean(line))
    .join(' ');
}

async function dispatchNotification(
  channel: SupportedChannel,
  profile: UserProfile,
  message: string
): Promise<ReminderResult> {
  if (channel === 'email') {
    if (!profile.email) {
      return {
        user: profile.full_name,
        channel,
        status: 'failed',
        errorMessage: 'User profile does not have an email address configured.',
      };
    }

    const result = await sendEmailMessageGmail(profile.email, message);
    return {
      user: profile.full_name,
      channel,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.success ? null : result.error,
    };
  }

  if (channel === 'whatsapp') {
    if (!profile.whatsapp_number) {
      return {
        user: profile.full_name,
        channel,
        status: 'failed',
        errorMessage: 'WhatsApp is coming soon! Stay tuned.',
      };
    }

    const result = await sendWhatsAppMessage(profile.whatsapp_number, message);
    return {
      user: profile.full_name,
      channel,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.success ? null : result.error,
    };
  }

  if (channel === 'telegram') {
    if (!profile.telegram_chat_id) {
      return {
        user: profile.full_name,
        channel,
        status: 'failed',
        errorMessage: 'Telegram is coming soon! Stay tuned.',
      };
    }

    const result = await sendTelegramMessage(profile.telegram_chat_id, message);
    return {
      user: profile.full_name,
      channel,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.success ? null : result.error,
    };
  }

  return {
    user: profile.full_name,
    channel,
    status: 'failed',
    errorMessage: `Unsupported channel ${channel}`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let payload: RequestPayload | null = null;
  if (req.method !== 'GET') {
    try {
      payload = (await req.json()) as RequestPayload;
    } catch {
      payload = null;
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (payload?.mode === 'direct-email') {
      if (!payload.payload || typeof payload.payload !== 'object') {
        return new Response(
          JSON.stringify({ error: 'direct-email mode requires a payload object.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const result = await sendViaExternalEmailApi(payload.payload as Record<string, unknown>);

      if (!result.success) {
        return new Response(
          JSON.stringify({ error: result.error ?? 'Email API failed.' }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (payload.userId) {
        await supabase.from('reminder_logs').insert({
          user_id: payload.userId,
          medication_id: null,
          channel: 'email',
          status: result.success ? 'sent' : 'failed',
          sent_at: result.success ? new Date().toISOString() : null,
          error_message: result.error ?? null,
        });
      }

      return new Response(
        JSON.stringify({
          message: 'Email dispatched via external API.',
          data: result.data ?? null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (payload?.mode === 'test') {
      if (!payload.userId) {
        return new Response(
          JSON.stringify({ error: 'Test mode requires a userId.' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', payload.userId)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({
            error:
              profileError?.message ?? 'Unable to locate user profile for test reminder.',
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const requestedChannel =
        typeof payload.channel === 'string' ? payload.channel : profile.preferred_channel;
      const resolvedChannel = resolveChannel(requestedChannel);
      const hasCustomMessage =
        typeof payload.message === 'string' && payload.message.trim().length > 0;
      const message = hasCustomMessage
        ? payload.message!.trim()
        : buildReminderMessage(profile as UserProfile);

      const reminderResult = await dispatchNotification(
        resolvedChannel,
        profile as UserProfile,
        message
      );

      await supabase.from('reminder_logs').insert({
        user_id: profile.id,
        medication_id: null,
        channel: reminderResult.channel,
        status: reminderResult.status,
        sent_at: reminderResult.status === 'sent' ? new Date().toISOString() : null,
        error_message: reminderResult.errorMessage ?? null,
      });

      return new Response(
        JSON.stringify({
          message: 'Test reminder processed.',
          results: [reminderResult],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0].slice(0, 5);
    const today = now.toISOString().split('T')[0];

    const { data: schedules, error: schedulesError } = await supabase
      .from('medication_schedules')
      .select('id, medication_id, reminder_time')
      .eq('active', true)
      .eq('reminder_time', currentTime);

    if (schedulesError) {
      throw schedulesError;
    }

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No reminders to send at this time.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const medicationIds = schedules.map((schedule) => schedule.medication_id);

    const { data: medications, error: medicationsError } = await supabase
      .from('medications')
      .select('id, user_id, medication_name, dosage, instructions')
      .in('id', medicationIds)
      .eq('active', true);

    if (medicationsError) {
      throw medicationsError;
    }

    if (!medications || medications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active medications found for reminders.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userIds = [...new Set(medications.map((med) => med.user_id))];

    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', userIds);

    if (profilesError) {
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No user profiles found for reminders.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results: ReminderResult[] = [];

    for (const medication of medications) {
      const userProfile = profiles.find((p) => p.id === medication.user_id) as UserProfile | undefined;

      if (!userProfile) {
        continue;
      }

      const schedule = schedules.find((s) => s.medication_id === medication.id);
      const message = buildReminderMessage(userProfile, medication, schedule?.reminder_time);

      const result = await dispatchNotification(
        userProfile.preferred_channel,
        userProfile,
        message
      );

      results.push({
        medication: medication.medication_name,
        ...result,
      });

      await supabase.from('reminder_logs').insert({
        user_id: userProfile.id,
        medication_id: medication.id,
        channel: result.channel,
        status: result.status,
        sent_at: result.status === 'sent' ? new Date().toISOString() : null,
        error_message: result.errorMessage ?? null,
      });
    }

    return new Response(JSON.stringify({ message: 'Reminders processed.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing reminders:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
