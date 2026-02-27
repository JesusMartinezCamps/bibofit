
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export default async function serve(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { food_id, user_id } = await req.json();

    if (!food_id) {
      return new Response(JSON.stringify({ error: "Missing food_id" }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch mappings for the specific food
    const { data: mappings, error } = await supabase
      .from('food_substitution_mappings')
      .select('*, target_food:target_food_id(id, name)')
      .eq('source_food_id', food_id)
      .order('confidence_score', { ascending: false });

    if (error) throw error;

    // Formatting response
    const substitutions = (mappings || []).map(m => ({
      target_food_id: m.target_food_id,
      target_food_name: m.target_food?.name,
      confidence: m.confidence_score,
      is_automatic: m.is_automatic,
      reason: m.reason,
      substitution_type: m.substitution_type,
      metadata: m.metadata
    }));

    return new Response(JSON.stringify({ substitutions }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
