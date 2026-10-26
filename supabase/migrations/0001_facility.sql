create table resources (
 id uuid primary key default gen_random_uuid(), code text not null unique check(length(trim(code))>0),
 name text not null check(length(trim(name))>0), location text not null, owner text not null,
 rate_cents integer check(rate_cents>=0), currency text check(currency ~ '^[A-Z]{3}$'),
 training_required boolean not null default true, reviewed boolean not null default false,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((rate_cents is null)=(currency is null))
);
create unique index resources_code_ci on resources(lower(code));
create table people (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index people_code_ci on people(lower(code));
create table credentials (
 id uuid primary key default gen_random_uuid(), person_id uuid not null references people, resource_id uuid not null references resources,
 valid_from date not null, valid_until date not null, evidence text not null check(length(trim(evidence))>0),
 assessor text not null, revoked boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(valid_until>=valid_from)
);
create table bookings (
 id uuid primary key default gen_random_uuid(), code text not null unique, resource_id uuid not null references resources,
 person_id uuid not null references people, project text not null, purpose text not null,
 starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null check(status in ('requested','approved','completed','cancelled','imported')) default 'requested',
 actual_minutes numeric(12,2) check(actual_minutes>=0), rate_cents integer check(rate_cents>=0), currency text,
 approved_by text, approved_at timestamptz,
 source_key text unique, source_hash text, source_row jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_at>starts_at), check((rate_cents is null)=(currency is null)),
 check(currency is null or currency ~ '^[A-Z]{3}$'),
 check(status!='completed' or actual_minutes is not null)
);
create unique index bookings_code_ci on bookings(lower(code));
create index bookings_window on bookings(resource_id,starts_at,ends_at);
create table maintenance (
 id uuid primary key default gen_random_uuid(), resource_id uuid not null references resources,
 starts_at timestamptz not null, ends_at timestamptz not null, reason text not null,
 owner text not null, evidence text, closed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(ends_at>starts_at)
);
create table events (
 id uuid primary key default gen_random_uuid(), subject_id uuid not null, actor text not null, action text not null,
 detail jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table imports (
 id uuid primary key default gen_random_uuid(), source text not null, sha256 text not null, rows_added integer not null, rows_skipped integer not null,
 actor text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
do $$ declare t text; begin foreach t in array array['resources','people','credentials','bookings','maintenance','events','imports'] loop
 execute format('create trigger touch_updated before update on %I for each row execute function touch_updated()',t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 end loop;end $$;
create view v_booking_week with(security_invoker=true) as
 select b.id,b.code,r.name as resource,p.name as person,b.project,b.starts_at,b.ends_at,b.status,
 round(extract(epoch from (b.ends_at-b.starts_at))/60,2) as booked_minutes,b.actual_minutes,
 b.rate_cents,b.currency,
 case when b.rate_cents is not null and b.actual_minutes is not null then round(b.actual_minutes*b.rate_cents/60)::bigint end as estimated_cents
 from bookings b join resources r on r.id=b.resource_id join people p on p.id=b.person_id;
create view v_compliance with(security_invoker=true) as
 select r.id as subject_id,r.code as reference,'RESOURCE_REVIEW'::text as rule,'Resource rules need review'::text as finding
 from resources r where not r.reviewed and r.active
 union all
 select b.id,b.code,'TRAINING','No current equipment training covering the booking'
 from bookings b join resources r on r.id=b.resource_id
 where b.status in ('requested','approved') and r.training_required and not exists
 (select 1 from credentials c where c.person_id=b.person_id and c.resource_id=b.resource_id and not c.revoked
 and c.valid_from<=b.starts_at::date and c.valid_until>=(b.ends_at-interval '1 microsecond')::date)
 union all
 select b.id,b.code,'MAINTENANCE','Booking overlaps an open maintenance hold'
 from bookings b where b.status in ('requested','approved') and exists
 (select 1 from maintenance m where m.resource_id=b.resource_id and m.closed_at is null and b.starts_at<m.ends_at and b.ends_at>m.starts_at)
 union all
 select b.id,b.code,'INACTIVE','Resource or operator is inactive'
 from bookings b join resources r on r.id=b.resource_id join people p on p.id=b.person_id
 where b.status in ('requested','approved') and (not r.active or not p.active)
 union all
 select b.id,b.code,'CONFLICT','Booking overlaps another approved booking'
 from bookings b where b.status in ('requested','approved') and exists
 (select 1 from bookings x where x.id<>b.id and x.resource_id=b.resource_id and x.status='approved' and b.starts_at<x.ends_at and b.ends_at>x.starts_at);
create view v_attention with(security_invoker=true) as
 select subject_id,reference,rule as kind,finding as detail from v_compliance
 union all select id,code,'USAGE_MISSING','Approved booking ended without a usage record' from bookings where status='approved' and ends_at<now()
 union all select m.id,r.code,'MAINTENANCE_OVERDUE',m.reason from maintenance m join resources r on r.id=m.resource_id where m.closed_at is null and m.ends_at<now()
 union all select id,code,'IMPORT_REVIEW','Imported history is isolated from the live booking calendar' from bookings where status='imported';
create view v_usage with(security_invoker=true) as
 select r.id,r.code,r.name as resource,count(b.id) as completed_sessions,
 coalesce(sum(round(extract(epoch from (b.ends_at-b.starts_at))/60,2)),0) as booked_minutes,
 coalesce(sum(b.actual_minutes),0) as actual_minutes,
 coalesce(sum(b.actual_minutes-round(extract(epoch from (b.ends_at-b.starts_at))/60,2)),0) as variance_minutes
 from resources r left join bookings b on b.resource_id=r.id and b.status='completed' group by r.id;
revoke all on v_booking_week,v_compliance,v_attention,v_usage from public;
