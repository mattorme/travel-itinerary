-- ============================================================================
-- Earned indexability.
--
-- Publishing every generated trip into the search index is the pattern search
-- engines classify as scaled content abuse, and the penalty lands on the whole
-- domain rather than the individual page. A trip therefore starts noindex and
-- becomes indexable only once a human has done something with it — edited it,
-- copied it, or liked it. See docs/ARCHITECTURE.md §12.
-- ============================================================================

create or replace function public.refresh_trip_indexability()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  with scored as (
    select
      t.id,
      -- Weighted toward the signals that are hard to fake and that correlate
      -- with a trip being genuinely useful to someone other than its author.
      (t.clone_count * 5.0)
      + (t.save_count * 3.0)
      + (t.like_count * 1.5)
      + least(t.view_count * 0.05, 20)
      + (case when exists (
          select 1 from public.activities a
            join public.trip_days d on d.id = a.trip_day_id
           where d.trip_id = t.id and a.source = 'user_added'
        ) then 8 else 0 end) as score
      from public.trips t
     where t.deleted_at is null
       and t.visibility = 'public'
       and t.moderation_state = 'approved'
       and t.status = 'ready'
  )
  update public.trips t
     set quality_score = scored.score,
         is_indexable  = scored.score >= 10
    from scored
   where t.id = scored.id
     and (t.quality_score is distinct from scored.score
          or t.is_indexable is distinct from (scored.score >= 10));

  get diagnostics touched = row_count;
  return touched;
end;
$$;
