create role web_anon nologin;
create role authenticator noinherit login password 'authenticator';
grant web_anon to authenticator;

grant usage on schema public to web_anon;
grant select on all tables in schema public to web_anon;
alter default privileges in schema public grant select on tables to web_anon;
