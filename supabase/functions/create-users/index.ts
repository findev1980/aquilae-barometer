import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const users = [
    { email: "patricia@aquilae.be", password: 'X&I5xB{z[i`fMK6H^`I_' },
    { email: "an@aquilae.be", password: "K5f^^O8!r[0N-]`'\\1`l" },
    { email: "maxime@aquilae.be", password: "*s^15YqqcqFbO]0d-Q<-" },
  ];

  const results = [];
  for (const u of users) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    results.push({ email: u.email, success: !error, error: error?.message });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
