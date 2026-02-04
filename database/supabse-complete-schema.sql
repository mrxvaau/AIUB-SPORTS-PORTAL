-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_audit_logs (
  id bigint NOT NULL DEFAULT nextval('admin_audit_logs_id_seq'::regclass),
  admin_id bigint NOT NULL,
  action character varying NOT NULL,
  target_type character varying,
  target_id bigint,
  action_time timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES public.admins(id)
);
CREATE TABLE public.admin_role_map (
  id bigint NOT NULL DEFAULT nextval('admin_role_map_id_seq'::regclass),
  admin_id bigint NOT NULL,
  role_id bigint NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_role_map_pkey PRIMARY KEY (id),
  CONSTRAINT fk_arm_admin FOREIGN KEY (admin_id) REFERENCES public.admins(id),
  CONSTRAINT fk_arm_role FOREIGN KEY (role_id) REFERENCES public.admin_roles(id)
);
CREATE TABLE public.admin_roles (
  id bigint NOT NULL DEFAULT nextval('admin_roles_id_seq'::regclass),
  role_name character varying NOT NULL UNIQUE,
  CONSTRAINT admin_roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.admins (
  id bigint NOT NULL DEFAULT nextval('admins_id_seq'::regclass),
  admin_id character varying NOT NULL UNIQUE,
  email character varying NOT NULL UNIQUE,
  full_name character varying NOT NULL,
  status character varying DEFAULT 'ACTIVE'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admins_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cart (
  id bigint NOT NULL DEFAULT nextval('cart_id_seq'::regclass),
  user_id integer,
  item_type character varying NOT NULL,
  item_id integer,
  tournament_game_id integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cart_pkey PRIMARY KEY (id),
  CONSTRAINT cart_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT cart_tournament_game_id_fkey FOREIGN KEY (tournament_game_id) REFERENCES public.tournament_games(id)
);
CREATE TABLE public.game_registrations (
  id bigint NOT NULL DEFAULT nextval('game_registrations_id_seq'::regclass),
  user_id integer,
  game_id integer,
  payment_status character varying DEFAULT 'PENDING'::character varying,
  registration_date timestamp with time zone DEFAULT now(),
  CONSTRAINT game_registrations_pkey PRIMARY KEY (id),
  CONSTRAINT game_registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT game_registrations_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.tournament_games(id)
);
CREATE TABLE public.game_requests (
  id bigint NOT NULL DEFAULT nextval('game_requests_id_seq'::regclass),
  tournament_id bigint NOT NULL,
  requested_by bigint NOT NULL,
  game_name character varying NOT NULL,
  category character varying,
  game_type character varying,
  status character varying DEFAULT 'PENDING'::character varying,
  approved_by bigint,
  approved_at timestamp with time zone,
  CONSTRAINT game_requests_pkey PRIMARY KEY (id),
  CONSTRAINT fk_gr_tournament FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT fk_gr_admin FOREIGN KEY (requested_by) REFERENCES public.admins(id),
  CONSTRAINT fk_gr_approver FOREIGN KEY (approved_by) REFERENCES public.admins(id)
);
CREATE TABLE public.notifications (
  id bigint NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  user_id integer,
  title character varying NOT NULL,
  message text NOT NULL,
  type character varying DEFAULT 'INFO'::character varying,
  status character varying DEFAULT 'UNREAD'::character varying,
  related_id integer,
  related_type character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.permissions (
  id bigint NOT NULL DEFAULT nextval('permissions_id_seq'::regclass),
  permission_name character varying NOT NULL UNIQUE,
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.role_permissions (
  id bigint NOT NULL DEFAULT nextval('role_permissions_id_seq'::regclass),
  role_id bigint NOT NULL,
  permission_id bigint NOT NULL,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES public.admin_roles(id),
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
);
CREATE TABLE public.team_members (
  id bigint NOT NULL DEFAULT nextval('team_members_id_seq'::regclass),
  team_id integer,
  user_id integer,
  role character varying DEFAULT 'MEMBER'::character varying,
  status character varying DEFAULT 'PENDING'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT team_members_pkey PRIMARY KEY (id),
  CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id),
  CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.teams (
  id bigint NOT NULL DEFAULT nextval('teams_id_seq'::regclass),
  tournament_game_id integer,
  team_name character varying NOT NULL,
  leader_user_id integer,
  status character varying DEFAULT 'PENDING'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_tournament_game_id_fkey FOREIGN KEY (tournament_game_id) REFERENCES public.tournament_games(id),
  CONSTRAINT teams_leader_user_id_fkey FOREIGN KEY (leader_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.tournament_games (
  id bigint NOT NULL DEFAULT nextval('tournament_games_id_seq'::regclass),
  tournament_id integer,
  category character varying NOT NULL,
  game_name character varying NOT NULL,
  game_type character varying NOT NULL,
  fee_per_person numeric,
  CONSTRAINT tournament_games_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_games_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournament_requests (
  id bigint NOT NULL DEFAULT nextval('tournament_requests_id_seq'::regclass),
  requested_by bigint NOT NULL,
  title character varying NOT NULL,
  description text,
  registration_deadline timestamp with time zone NOT NULL,
  status character varying DEFAULT 'PENDING'::character varying,
  reviewed_by bigint,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournament_requests_pkey PRIMARY KEY (id),
  CONSTRAINT fk_tr_requester FOREIGN KEY (requested_by) REFERENCES public.admins(id),
  CONSTRAINT fk_tr_reviewer FOREIGN KEY (reviewed_by) REFERENCES public.admins(id)
);
CREATE TABLE public.tournaments (
  id bigint NOT NULL DEFAULT nextval('tournaments_id_seq'::regclass),
  title character varying NOT NULL,
  photo_url text,
  registration_deadline timestamp with time zone NOT NULL,
  status character varying DEFAULT 'ACTIVE'::character varying,
  description text,
  created_by integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tournaments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id bigint NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  student_id character varying NOT NULL UNIQUE,
  email character varying NOT NULL,
  full_name character varying,
  gender character varying,
  phone_number character varying,
  blood_group character varying,
  program_level character varying,
  department character varying,
  name_edit_count integer DEFAULT 0,
  is_first_login boolean DEFAULT true,
  profile_completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_login timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);                        
 ---------------             function ------ 
  SELECT
    true AS is_admin,
    'SUPER_ADMIN' AS role_name;
