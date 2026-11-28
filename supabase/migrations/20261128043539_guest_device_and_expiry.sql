create extension if not exists pg_cron;

alter table private.kf_guest_credentials
  add column device_digest text,
  add column expires_at timestamptz;

update private.kf_guest_credentials
set expires_at = created_at + interval '720 hours';

alter table private.kf_guest_credentials
  alter column expires_at set default (now() + interval '720 hours'),
  alter column expires_at set not null;

create index kf_guest_credentials_expiry_idx on private.kf_guest_credentials (expires_at);
create index if not exists kf_guest_sessions_guest_id_idx on private.kf_guest_sessions (guest_id);

CREATE OR REPLACE FUNCTION public.kf_server_guest(action text, p jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  rec record;
  n integer;
  result jsonb;
begin
  if action = 'attempt' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p->>'client_digest'));
    select count(*) into n from private.kf_guest_login_attempts
      where client_digest = p->>'client_digest'
      and created_at >= pg_catalog.now() - interval '15 minutes';
    if n >= 20 then return jsonb_build_object('limited',true); end if;
    insert into private.kf_guest_login_attempts(client_digest) values (p->>'client_digest');
    return jsonb_build_object('limited',false);
  elsif action = 'credential' then
    select id,label,password_hash,password_salt,revoked_at,expires_at into rec
    from private.kf_guest_credentials
    where lookup_digest = p->>'lookup_digest';
    if not found then return '{}'::jsonb; end if;
    return jsonb_build_object('id',rec.id,'password_hash',rec.password_hash,
      'password_salt',rec.password_salt,'label',rec.label,
      'revoked',rec.revoked_at is not null or rec.expires_at <= now());
  elsif action = 'create-session' then
    if coalesce(p->>'device_digest','') !~ '^[a-f0-9]{64}$' then
      return jsonb_build_object('ok',false);
    end if;
    -- Updating the row serializes first use, concurrent logins and revocation.
    update private.kf_guest_credentials
      set device_digest = p->>'device_digest'
      where id = (p->>'guest_id')::uuid
        and revoked_at is null and expires_at > now()
        and (device_digest is null or device_digest = p->>'device_digest')
      returning id, expires_at into rec;
    if not found then return jsonb_build_object('ok',false); end if;
    insert into private.kf_guest_sessions(token_digest,guest_id,expires_at)
    values (p->>'token_digest',rec.id,least(rec.expires_at,now() + interval '8 hours'));
    return jsonb_build_object('ok',true);
  elsif action = 'session-valid' then
    select exists(
      select 1 from private.kf_guest_sessions s
      join private.kf_guest_credentials c on c.id=s.guest_id
      where s.token_digest=p->>'token_digest'
      and s.expires_at>now() and c.expires_at>now() and c.revoked_at is null
      and c.device_digest=p->>'device_digest'
    ) into rec;
    return jsonb_build_object('valid',rec.exists);
  elsif action = 'logout' then
    delete from private.kf_guest_sessions s using private.kf_guest_credentials c
      where c.id=s.guest_id and s.token_digest=p->>'token_digest'
        and c.device_digest=p->>'device_digest';
    return jsonb_build_object('ok',true);
  elsif action = 'create-guest' then
    insert into private.kf_guest_credentials(label,lookup_digest,password_hash,password_salt)
      values(p->>'label',p->>'lookup_digest',p->>'password_hash',p->>'password_salt')
    returning id,expires_at into rec;
    return jsonb_build_object('id',rec.id,'expires_at',rec.expires_at);
  elsif action = 'list-guests' then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,
      'created_at',created_at,'expires_at',expires_at,'activated',device_digest is not null,'revoked_at',revoked_at) order by created_at desc),'[]'::jsonb)
      into result from private.kf_guest_credentials where expires_at > now();
    return result;
  elsif action = 'revoke-guest' then
    update private.kf_guest_credentials set revoked_at=pg_catalog.now()
      where id=(p->>'id')::uuid;
    delete from private.kf_guest_sessions where guest_id=(p->>'id')::uuid;
    return jsonb_build_object('ok',true);
  else
    raise exception 'Unsupported action' using errcode='22023';
  end if;
end;
$function$;

select cron.schedule('kf-purge-expired-guests', '* * * * *', $job$
  delete from private.kf_guest_credentials where expires_at <= now();
  delete from private.kf_guest_sessions where expires_at <= now();
$job$);
