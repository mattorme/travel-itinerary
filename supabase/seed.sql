-- ============================================================================
-- Local development seed.
--
-- Enough real geography for the destination hub and explore pages to have
-- something to render before any generation has been run. Deliberately does NOT
-- seed place_cache: that table holds Google Maps Content under a TTL, and
-- fabricating rows there would be modelling the one thing the architecture is
-- careful about.
-- ============================================================================

insert into public.destinations
  (slug, name, kind, country_code, country_name, lat, lng, timezone, cost_index, currency, is_curated, blurb)
values
  ('tokyo-jp',      'Tokyo',       'city', 'JP', 'Japan',     35.6812,  139.7671, 'Asia/Tokyo',       1.00, 'JPY', true,
   'Enormous, orderly, and far more walkable than its size suggests. Tokyo rewards picking one or two neighbourhoods a day and going deep rather than sprinting between landmarks.'),
  ('kyoto-jp',      'Kyoto',       'city', 'JP', 'Japan',     35.0116,  135.7681, 'Asia/Tokyo',       0.95, 'JPY', true,
   'Compact enough to cross by bicycle, dense enough that you will not see it all. Mornings at the temples, afternoons in the machiya streets.'),
  ('lisbon-pt',     'Lisbon',      'city', 'PT', 'Portugal',  38.7223,   -9.1393, 'Europe/Lisbon',    0.85, 'EUR', true,
   'Hilly, tiled, and best taken slowly. The good days here are the ones with fewer things on them.'),
  ('mexico-city-mx','Mexico City', 'city', 'MX', 'Mexico',    19.4326,  -99.1332, 'America/Mexico_City', 0.60, 'MXN', true,
   'One of the great eating cities. Plan around meals and let the neighbourhoods follow.'),
  ('rome-it',       'Rome',        'city', 'IT', 'Italy',     41.9028,   12.4964, 'Europe/Rome',      1.05, 'EUR', true,
   'Layered and loud. Pick a quarter, walk it properly, and accept that you are not seeing everything.'),
  ('havana-cu',     'Havana',      'city', 'CU', 'Cuba',      23.1136,  -82.3666, 'America/Havana',   0.55, 'CUP', true,
   'Slow infrastructure, fast streets. Cash, patience and a loose plan go further here than a packed schedule.')
on conflict (slug) do nothing;

-- Indicative FX snapshot so budgets render in the wizard's currencies before the
-- rates cron has ever run. Refreshed daily in production.
insert into public.fx_rates (base, quote, as_of, rate) values
  ('USD','AUD', current_date, 1.52),
  ('USD','EUR', current_date, 0.92),
  ('USD','GBP', current_date, 0.78),
  ('USD','JPY', current_date, 152.0),
  ('USD','NZD', current_date, 1.66),
  ('USD','CAD', current_date, 1.37),
  ('USD','SGD', current_date, 1.34)
on conflict (base, quote, as_of) do nothing;

-- ---------------------------------------------------------------------------
-- A demo trip.
--
-- Its activities carry no place_id, so this also exercises the cold-cache path:
-- if a trip page renders correctly here, it renders correctly when Google
-- content has expired. That resilience is the whole reason `activities.title`
-- is authored text rather than a copy of a Google display name.
-- ---------------------------------------------------------------------------
do $$
declare
  demo_user uuid := '00000000-0000-0000-0000-0000000dee00';
  demo_trip uuid := '00000000-0000-0000-0000-000000010000';
  tokyo     uuid;
  d1 uuid; d2 uuid; d3 uuid;
begin
  if exists (select 1 from auth.users where id = demo_user) then
    return;
  end if;

  select id into tokyo from public.destinations where slug = 'tokyo-jp';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_anonymous
  ) values (
    demo_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'demo@wayfare.local', '', now(), now(), now(), '{}'::jsonb,
    '{"full_name":"Demo Traveller"}'::jsonb, false
  );

  update public.profiles
     set username = 'demo', display_name = 'Demo Traveller',
         bio = 'Seeded so the public trip page has something to show in development.'
   where id = demo_user;

  insert into public.trips (
    id, owner_id, slug, title, subtitle, status, visibility, moderation_state,
    start_date, end_date, duration_days, date_mode, party, currency,
    budget_total, budget_daily, travel_style, pace, interests, transport_modes,
    food_prefs, accommodation_pref, user_notes, summary, highlights,
    estimated_cost_total, estimated_cost_breakdown, published_at
  ) values (
    demo_trip, demo_user, 'three-slow-days-in-tokyo',
    'Three slow days in Tokyo',
    'Two neighbourhoods, properly, instead of six in a hurry',
    'ready', 'public', 'approved',
    current_date + 30, current_date + 32, 3, 'exact',
    '{"adults":2,"children":[]}'::jsonb, 'AUD',
    1800, 600, 'balanced', 'relaxed',
    array['food','history','architecture'], array['walking','transit']::public.transport_mode[],
    array['local_food'], 'hotel',
    'Main sights are fine but I would rather not queue. I love history and food, and I do not want nightlife.',
    'A trip that trades breadth for depth. Three days is not enough to see Tokyo, so this does not try — it takes the old east side slowly, spends a full day on the western hills, and leaves room to sit down. Nothing here needs a reservation more than a week out.',
    array['A morning in Yanaka before the crowds', 'Standing-room soba near the fish market', 'One long walk with no fixed end'],
    1642.00,
    '{"accommodation":930,"food":392,"activities":186,"localTransport":54,"buffer":80,"total":1642,"excludesFlights":true}'::jsonb,
    now()
  );

  insert into public.trip_destinations (trip_id, destination_id, order_index, first_day_index, nights)
  values (demo_trip, tokyo, 0, 1, 2);

  insert into public.trip_days (trip_id, day_index, date, title, summary, destination_id, estimated_cost)
  values
    (demo_trip, 1, current_date + 30, 'The old east side',
     'Start where Tokyo still looks like its own past. Yanaka and Nezu were spared the worst of the war and the bubble, so the streets are narrow, low and quiet. Nothing today is more than twenty minutes from the last thing.',
     tokyo, 148),
    (demo_trip, 2, current_date + 31, 'West, and uphill',
     'A day with more distance in it, but only two real moves. Morning in the gardens, afternoon in the hills behind the city, and a long sit-down dinner to end it.',
     tokyo, 236),
    (demo_trip, 3, current_date + 32, 'No plan, on purpose',
     'The last day is deliberately loose. One anchor in the morning, one meal booked, and the rest left for whatever you liked enough on the first two days to go back to.',
     tokyo, 194);

  select id into d1 from public.trip_days where trip_id = demo_trip and day_index = 1;
  select id into d2 from public.trip_days where trip_id = demo_trip and day_index = 2;
  select id into d3 from public.trip_days where trip_id = demo_trip and day_index = 3;

  insert into public.activities
    (trip_day_id, order_index, kind, custom_name, title, description, reason,
     start_time, end_time, duration_minutes, estimated_cost, inbound_travel)
  values
    (d1, 1, 'activity', 'Yanaka Cemetery walk', 'Yanaka Cemetery walk',
     'A wide avenue of cherry trees running through one of the few parts of the city that survived both the 1923 earthquake and the firebombing. Locals treat it as a park.',
     'Quiet, free, and the best possible first hour in Tokyo before anything is open.',
     '09:30', '10:30', 60, 0, null),
    (d1, 2, 'activity', 'Yanaka Ginza', 'Yanaka Ginza',
     'A single sloping shopping street, about 170 metres end to end, still mostly small independent shops.',
     'Ten minutes on foot from the cemetery and exactly the kind of street you said you wanted.',
     '10:50', '11:50', 60, 0,
     '{"mode":"walking","minutes":12,"meters":900,"polyline":null,"source":"routes"}'::jsonb),
    (d1, 3, 'meal', 'Soba lunch, Nezu', 'Soba lunch in Nezu',
     'Handmade buckwheat noodles, cold in summer and hot in winter. Counter seating, cash, twenty minutes start to finish.',
     'Local, cheap, and no queue at midday on a weekday.',
     '12:20', '13:20', 60, 38,
     '{"mode":"walking","minutes":14,"meters":1100,"polyline":null,"source":"routes"}'::jsonb),
    (d1, 4, 'activity', 'Nezu Shrine', 'Nezu Shrine',
     'Early 1700s, and one of the few shrine complexes in the city with its original buildings still standing. The tunnel of small red gates is the reason most people come.',
     'History and architecture in one stop, five minutes from lunch.',
     '13:50', '15:00', 70, 0,
     '{"mode":"walking","minutes":8,"meters":600,"polyline":null,"source":"routes"}'::jsonb),
    (d1, 5, 'meal', 'Izakaya dinner, Nezu', 'Dinner at a neighbourhood izakaya',
     'Small plates, ordered a few at a time. Sit at the counter if there is room.',
     'You said no nightlife — this is dinner that happens to run late, not a night out.',
     '18:30', '20:15', 105, 110,
     '{"mode":"walking","minutes":9,"meters":700,"polyline":null,"source":"routes"}'::jsonb),

    (d2, 1, 'meal', 'Coffee, Kiyosumi', 'Coffee in Kiyosumi',
     'A roastery in a converted warehouse. Go early; it fills up by ten.',
     'Worth building the morning around rather than treating as a stop.',
     '09:00', '09:45', 45, 24, null),
    (d2, 2, 'activity', 'Kiyosumi Teien', 'Kiyosumi Teien',
     'A stroll garden built around a pond, with stepping stones set just far enough apart to make you slow down. Takes about an hour.',
     'The stepping stones are the point — it is a garden that physically enforces a relaxed pace.',
     '10:00', '11:15', 75, 12,
     '{"mode":"walking","minutes":6,"meters":450,"polyline":null,"source":"routes"}'::jsonb),
    (d2, 3, 'meal', 'Lunch, Monzen-Nakacho', 'Lunch in Monzen-Nakacho',
     'An old temple-town district that still eats like one. Set lunches, no English menu, done by two.',
     'Fifteen minutes on the metro and a completely different Tokyo from the morning.',
     '12:15', '13:20', 65, 46,
     '{"mode":"transit","minutes":16,"meters":2400,"polyline":null,"source":"routes"}'::jsonb),
    (d2, 4, 'activity', 'Mount Takao', 'Mount Takao',
     'Under an hour from Shinjuku on a single train, then a two-hour walk to the summit and back. Trail 1 is paved most of the way.',
     'The one long move of the trip, and the only day with enough slack to absorb it.',
     '15:00', '18:30', 210, 42,
     '{"mode":"transit","minutes":68,"meters":48000,"polyline":null,"source":"routes"}'::jsonb),

    (d3, 1, 'activity', 'Tsukiji Outer Market', 'Tsukiji Outer Market',
     'The wholesale auction moved to Toyosu years ago, but the outer market is still here and still where the restaurants shop. Best before nine.',
     'You wanted food and no queues; nine o''clock on a weekday is how you get both.',
     '08:30', '10:00', 90, 34, null),
    (d3, 2, 'activity', 'Hama-rikyu Gardens', 'Hama-rikyu Gardens',
     'A shogunal duck-hunting ground turned public garden, with a 300-year-old pine and a teahouse on an island in the middle.',
     'Ten minutes'' walk from the market and the natural place to sit down after it.',
     '10:20', '11:40', 80, 10,
     '{"mode":"walking","minutes":11,"meters":850,"polyline":null,"source":"routes"}'::jsonb),
    (d3, 3, 'meal', 'Sushi lunch, Tsukiji', 'Sushi lunch back at Tsukiji',
     'Counter sushi, lunch price, ten or twelve pieces chosen by the chef.',
     'Booked — this is the one thing on the trip worth reserving.',
     '12:30', '13:45', 75, 150,
     '{"mode":"walking","minutes":11,"meters":850,"polyline":null,"source":"routes"}'::jsonb);
end $$;
