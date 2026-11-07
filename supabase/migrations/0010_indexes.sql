-- 0010: indexes for the app's hot queries and the SECURITY DEFINER functions (W7).
-- Every foreign key now has a covering index (Supabase advisor: unindexed_foreign_keys).
-- Already covered before this migration, so not repeated here:
--   matches(project_id, ...) by matches_unique, team_members(project_id, ...) by its pkey,
--   team_members(user_id, ...) by team_members_user_project, swipes(swiper_id, target_id, ...)
--   by the swipes unique key, match_messages(match_id) by match_messages_match.
-- Plain (not concurrent) builds: the tables are small, and this runs in one transaction.

begin;

-- getActivity: vault_log where author_id = me order by seq desc limit 10
create index if not exists vault_log_author_seq on public.vault_log (author_id, seq desc);
-- project_commit_hash: vault_log where project_id = p order by seq desc limit 1
create index if not exists vault_log_project_seq on public.vault_log (project_id, seq desc);

-- getMatches / RLS on matches for the matched user, record_swipe, respond_interested
create index if not exists matches_user on public.matches (user_id);

-- getScoreEvents: reliability_events where user_id = me order by created_at
create index if not exists reliability_events_user_created on public.reliability_events (user_id, created_at);

-- get_interested and the deck's "is super" checks: swipes where target_id = me
create index if not exists swipes_target on public.swipes (target_id);
-- super_commits_left and undo_last_swipe: swipes where swiper_id = me order by created_at desc
create index if not exists swipes_swiper_created on public.swipes (swiper_id, created_at desc);
-- foreign key cover (project delete cascades)
create index if not exists swipes_project on public.swipes (project_id);

-- getHackRoles, project_role_counts, get_deck, commit_to_project: project_roles by project (and role)
create index if not exists project_roles_project_role on public.project_roles (project_id, role);

-- getMyProjects, getActivity, get_deck, ensure_hack_team, owner RLS checks: projects by owner
create index if not exists projects_owner_created on public.projects (owner_id, created_at);

-- getMessages: match_messages where match_id = m order by created_at
create index if not exists match_messages_match_created on public.match_messages (match_id, created_at);
create index if not exists match_messages_sender on public.match_messages (sender_id);

-- getCopyAlerts: copy_alerts for the owner, newest first
create index if not exists copy_alerts_owner_created on public.copy_alerts (owner_id, created_at desc);
create index if not exists copy_alerts_copier on public.copy_alerts (copier_id);

-- remaining foreign key covers
create index if not exists messages_sender on public.messages (sender_id);
create index if not exists post_attempts_user on public.post_attempts (user_id);
create index if not exists team_keys_user on public.team_keys (user_id);

commit;
