#!/usr/bin/env python3
"""Capture the local demo database through a read-only PostgreSQL connection."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def query(sql):
    result = subprocess.run([
        'docker', 'exec', '-e', 'PGOPTIONS=-c default_transaction_read_only=on',
        'notifyhub-postgres', 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
        '-U', 'notifyhub_app', '-d', 'notifyhub', '-At', '-c', sql,
    ], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


tables = []
for name in ['flyway_schema_history', 'notification_log', 'notification_template']:
    # Names are a fixed allowlist; no browser input reaches this capture script.
    row_limit = ' LIMIT 25' if name == 'notification_log' else ''
    table = query(f"""
      SELECT json_build_object(
        'name', '{name}',
        'columns', (SELECT json_agg(json_build_object(
          'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
          'nullable', NOT a.attnotnull,
          'default', pg_get_expr(d.adbin, d.adrelid),
          'primary', EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=a.attrelid AND i.indisprimary AND a.attnum=ANY(i.indkey)),
          'indexed', EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=a.attrelid AND a.attnum=ANY(i.indkey))
        ) ORDER BY a.attnum) FROM pg_attribute a
          LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
          WHERE a.attrelid='public.{name}'::regclass AND a.attnum>0 AND NOT a.attisdropped),
        'keys', (SELECT coalesce(json_agg(json_build_object(
          'name', conname, 'definition', pg_get_constraintdef(oid), 'primary', contype='p'
        ) ORDER BY conname), '[]'::json) FROM pg_constraint WHERE conrelid='public.{name}'::regclass AND contype IN ('p','u')),
        'indexes', (SELECT json_agg(json_build_object('name',indexname,'definition',indexdef) ORDER BY indexname)
          FROM pg_indexes WHERE schemaname='public' AND tablename='{name}'),
        'rows', (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM public.{name} ORDER BY 1{row_limit}) t)
      );
    """)
    for column in table['columns']:
        column['type'] = column['type'].replace('character varying', 'varchar').replace('timestamp without time zone', 'timestamp')
    table['indexes'].sort(key=lambda index: (not index['name'].endswith('_pkey'), index['name']))
    tables.append(table)

objects = query("""
 SELECT json_build_object(
   'access methods',(SELECT json_agg(amname ORDER BY amname) FROM pg_am),
   'casts',(SELECT json_agg(format_type(castsource,NULL)||' → '||format_type(casttarget,NULL) ORDER BY castsource,casttarget) FROM pg_cast),
   'extensions',(SELECT json_agg(extname ORDER BY extname) FROM pg_extension),
   'languages',(SELECT json_agg(lanname ORDER BY lanname) FROM pg_language)
 );
""")
snapshot = {
    'provenance': 'Read-only capture of the local NotifyHub demo PostgreSQL database; the web UI never connects to a database.',
    'dataSource': 'notifyhub@localhost', 'database': 'notifyhub', 'schema': 'public',
    'tables': tables,
    'sequences': query("SELECT json_agg(json_build_object('name',sequencename,'type',data_type,'start',start_value,'increment',increment_by) ORDER BY sequencename) FROM pg_sequences WHERE schemaname='public';"),
    'objects': objects,
}
(ROOT / 'dist/database.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({table['name']: len(table['rows']) for table in tables}))
