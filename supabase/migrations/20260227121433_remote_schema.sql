alter table "public"."food_substitution_mappings" drop constraint "food_substitution_mappings_source_food_id_target_food_id_key";

drop index if exists "public"."food_substitution_mappings_source_food_id_target_food_id_key";

CREATE UNIQUE INDEX idx_food_substitution_source_target_context_key ON public.food_substitution_mappings USING btree (source_food_id, target_food_id, COALESCE(NULLIF((metadata ->> 'context_key'::text), ''::text), 'general'::text));


