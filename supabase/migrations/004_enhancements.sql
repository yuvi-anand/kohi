-- Hours storage on coffee shops
alter table coffee_shops add column if not exists hours jsonb;

-- Aggregated shop rating stats view (no personal data exposed)
create or replace view shop_rating_stats as
select
  shop_id,
  round(avg(overall)::numeric, 1) as avg_overall,
  round(avg(coffee_quality)::numeric, 1) as avg_coffee,
  round(avg(vibes)::numeric, 1) as avg_vibes,
  count(*)::int as rating_count
from ratings
group by shop_id;

grant select on shop_rating_stats to anon, authenticated;
