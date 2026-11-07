-- Reset Juan's two demo accounts (juan-claude, Nov 7): clears their swipes so the deck refills,
-- then adds 24 fresh projects and 10 ready matches for each account. Run once in the Supabase SQL editor.
delete from public.swipes where swiper_id in (select id from auth.users where email in ('juancstlseg@gmail.com','cstlfjuan@gmail.com'));

do $$
declare
  v_email text := 'juancstlseg@gmail.com';
  v_me uuid;
  v_owner uuid;
  v_pid uuid;
  v_i int := 0;
  p record;
begin
  select id into v_me from auth.users where email = v_email;
  if v_me is null then raise exception 'No account with email %', v_email; end if;

  for p in
    select * from (values
      ('StudyBuddy Radar','Finds classmates studying the same chapter tonight, right now.','Education','weekend',false,'Backend','Design'),
      ('Campus Eats Split','Splits group food orders and settles up before the food arrives.','Food','weekend',false,'Mobile','Backend'),
      ('GreenRoute','Bike commute planner that picks the route with the cleanest air.','Climate','1 month',false,'Mobile','Backend'),
      ('Courtside','Live stats for pickup basketball, kept by whoever is on the bench.','Sports','1 month',false,'Frontend','Mobile'),
      ('LabLog','A shared lab notebook that timestamps every result like a commit.','Science','semester',false,'Backend','AI/ML'),
      ('Pocket Mentor','Matches first-years with seniors in their major for 15 minute calls.','Education','semester',false,'Full stack','Design'),
      ('ShelfSwap','Trade textbooks with people on your campus instead of reselling online.','Campus','weekend',false,'Mobile','Backend'),
      ('NoteForge','Turns messy lecture recordings into clean, searchable notes.','AI','1 month',false,'AI/ML','Frontend'),
      ('Quiet Hours','Finds the emptiest study spots on campus from live check-ins.','Campus','weekend',false,'Mobile','Data'),
      ('Hackathon Hub','One feed for every hackathon near you, with team-up threads.','Social','ongoing',false,'Frontend','Backend'),
      ('SafeWalk','Shares your walk home with friends and pings them if you stop.','Security','1 month',false,'Mobile','Security'),
      ('BudgetBento','Weekly meal plans that fit a student budget and a tiny kitchen.','Food','1 month',false,'Design','Backend'),
      ('Ledgerly','Shared expenses for roommates with receipts nobody can edit later.','Fintech','semester',false,'Backend','Security'),
      ('Pixel Garden','A cozy co-op game where friends grow a garden one commit at a time.','Games','semester',false,'Game dev','Design'),
      ('ClinicQueue','Shows wait times at campus health so students stop guessing.','Health','1 month',false,'Full stack','Data'),
      ('VoiceNotes AR','Leave voice notes pinned to places for your friends to find.','Social','semester',false,'AR/VR','Mobile'),
      ('HerStack','Pairs women in CS with study partners and project teams.','Education','ongoing',true,'Frontend','Backend'),
      ('SafeRide Circle','Rides home shared only with women you have verified in person.','Security','1 month',true,'Mobile','Security'),
      ('Bloom Budget','Money coaching for students, built by and for women.','Fintech','semester',true,'Design','Backend'),
      ('CycleSync','A private cycle tracker that never leaves your phone.','Health','1 month',true,'Mobile','Security'),
      ('Mentor Match','Connects women engineers with mentors one year ahead.','Social','ongoing',true,'Full stack','Design'),
      ('Studio Hours','Books maker space time and finds women to build with.','Campus','weekend',true,'Frontend','Hardware'),
      ('ShipIt Sisters','Weekend build sprints with a demo night every Sunday.','Social','weekend',true,'Backend','PM'),
      ('Kindred Notes','Shared class notes for women-only study groups.','Education','semester',true,'Frontend','AI/ML')
    ) as t(title, pitch, theme, timeframe, women, role_a, role_b)
  loop
    -- Owners are existing demo profiles other than you; women-only projects need a Women mode owner.
    select id into v_owner from public.profiles
     where id <> v_me and coalesce(women_only, false) = p.women
     order by random() limit 1;
    if v_owner is null then continue; end if;

    insert into public.projects (owner_id, title, short_pitch, type, theme, timeframe, visibility, idea_public, women_only, hours_per_week)
    values (v_owner, p.title, p.pitch, 'original', p.theme, p.timeframe, 'public', p.pitch, p.women, 8)
    returning id into v_pid;

    insert into public.project_roles (project_id, role, level, slots_open)
    values (v_pid, p.role_a, 'intermediate', 1), (v_pid, p.role_b, 'beginner', 1);

    insert into public.team_members (project_id, user_id, role, ownership)
    values (v_pid, v_owner, p.role_a, 'owner') on conflict do nothing;

    -- Every other project becomes a ready match for you (10 of them).
    v_i := v_i + 1;
    if v_i % 2 = 0 and v_i <= 20 then
      insert into public.matches (project_id, user_id, role, owner_committed, user_committed)
      values (v_pid, v_me, p.role_b, true, false) on conflict do nothing;
    end if;
  end loop;
end $$;

do $$
declare
  v_email text := 'cstlfjuan@gmail.com';
  v_me uuid;
  v_owner uuid;
  v_pid uuid;
  v_i int := 0;
  p record;
begin
  select id into v_me from auth.users where email = v_email;
  if v_me is null then raise exception 'No account with email %', v_email; end if;

  for p in
    select * from (values
      ('StudyBuddy Radar','Finds classmates studying the same chapter tonight, right now.','Education','weekend',false,'Backend','Design'),
      ('Campus Eats Split','Splits group food orders and settles up before the food arrives.','Food','weekend',false,'Mobile','Backend'),
      ('GreenRoute','Bike commute planner that picks the route with the cleanest air.','Climate','1 month',false,'Mobile','Backend'),
      ('Courtside','Live stats for pickup basketball, kept by whoever is on the bench.','Sports','1 month',false,'Frontend','Mobile'),
      ('LabLog','A shared lab notebook that timestamps every result like a commit.','Science','semester',false,'Backend','AI/ML'),
      ('Pocket Mentor','Matches first-years with seniors in their major for 15 minute calls.','Education','semester',false,'Full stack','Design'),
      ('ShelfSwap','Trade textbooks with people on your campus instead of reselling online.','Campus','weekend',false,'Mobile','Backend'),
      ('NoteForge','Turns messy lecture recordings into clean, searchable notes.','AI','1 month',false,'AI/ML','Frontend'),
      ('Quiet Hours','Finds the emptiest study spots on campus from live check-ins.','Campus','weekend',false,'Mobile','Data'),
      ('Hackathon Hub','One feed for every hackathon near you, with team-up threads.','Social','ongoing',false,'Frontend','Backend'),
      ('SafeWalk','Shares your walk home with friends and pings them if you stop.','Security','1 month',false,'Mobile','Security'),
      ('BudgetBento','Weekly meal plans that fit a student budget and a tiny kitchen.','Food','1 month',false,'Design','Backend'),
      ('Ledgerly','Shared expenses for roommates with receipts nobody can edit later.','Fintech','semester',false,'Backend','Security'),
      ('Pixel Garden','A cozy co-op game where friends grow a garden one commit at a time.','Games','semester',false,'Game dev','Design'),
      ('ClinicQueue','Shows wait times at campus health so students stop guessing.','Health','1 month',false,'Full stack','Data'),
      ('VoiceNotes AR','Leave voice notes pinned to places for your friends to find.','Social','semester',false,'AR/VR','Mobile'),
      ('HerStack','Pairs women in CS with study partners and project teams.','Education','ongoing',true,'Frontend','Backend'),
      ('SafeRide Circle','Rides home shared only with women you have verified in person.','Security','1 month',true,'Mobile','Security'),
      ('Bloom Budget','Money coaching for students, built by and for women.','Fintech','semester',true,'Design','Backend'),
      ('CycleSync','A private cycle tracker that never leaves your phone.','Health','1 month',true,'Mobile','Security'),
      ('Mentor Match','Connects women engineers with mentors one year ahead.','Social','ongoing',true,'Full stack','Design'),
      ('Studio Hours','Books maker space time and finds women to build with.','Campus','weekend',true,'Frontend','Hardware'),
      ('ShipIt Sisters','Weekend build sprints with a demo night every Sunday.','Social','weekend',true,'Backend','PM'),
      ('Kindred Notes','Shared class notes for women-only study groups.','Education','semester',true,'Frontend','AI/ML')
    ) as t(title, pitch, theme, timeframe, women, role_a, role_b)
  loop
    -- Owners are existing demo profiles other than you; women-only projects need a Women mode owner.
    select id into v_owner from public.profiles
     where id <> v_me and coalesce(women_only, false) = p.women
     order by random() limit 1;
    if v_owner is null then continue; end if;

    insert into public.projects (owner_id, title, short_pitch, type, theme, timeframe, visibility, idea_public, women_only, hours_per_week)
    values (v_owner, p.title, p.pitch, 'original', p.theme, p.timeframe, 'public', p.pitch, p.women, 8)
    returning id into v_pid;

    insert into public.project_roles (project_id, role, level, slots_open)
    values (v_pid, p.role_a, 'intermediate', 1), (v_pid, p.role_b, 'beginner', 1);

    insert into public.team_members (project_id, user_id, role, ownership)
    values (v_pid, v_owner, p.role_a, 'owner') on conflict do nothing;

    -- Every other project becomes a ready match for you (10 of them).
    v_i := v_i + 1;
    if v_i % 2 = 0 and v_i <= 20 then
      insert into public.matches (project_id, user_id, role, owner_committed, user_committed)
      values (v_pid, v_me, p.role_b, true, false) on conflict do nothing;
    end if;
  end loop;
end $$;
