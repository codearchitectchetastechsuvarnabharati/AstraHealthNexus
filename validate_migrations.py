"""Validate migrations on a disposable local PostgreSQL cluster (no application DB access)."""
import argparse
import ctypes
import ctypes.util
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / 'server/prisma/schema.prisma'
MIGRATIONS = SCHEMA.parent / 'migrations'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--postgres-bin', required=True, help='Directory containing initdb and pg_ctl')
    args = parser.parse_args()
    binaries = Path(args.postgres_bin).resolve()
    suffix = '.exe' if os.name == 'nt' else ''
    programs = {name: binaries / (name + suffix) for name in ['initdb', 'pg_ctl']}
    for program in programs.values():
        if not program.is_file():
            raise SystemExit(f'Missing PostgreSQL executable: {program}')
    node = shutil.which('node')
    cli = ROOT / 'node_modules/prisma/build/index.js'
    if not node or not cli.is_file():
        raise SystemExit('Install project dependencies and ensure Node is on PATH first')
    workspace = Path(tempfile.mkdtemp(prefix='astra-migrations-')).resolve()
    data = workspace / 'data'
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    base_env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
    base_env['PRISMA_HIDE_UPDATE_MESSAGE'] = '1'
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0

    def run(command, env=None, expected=0):
        # File handles avoid Windows daemon children holding captured pipes open.
        with tempfile.TemporaryFile(mode='w+b') as output:
            result = subprocess.run([str(item) for item in command], cwd=ROOT, env=env or base_env,
                                    stdout=output, stderr=output, timeout=90, creationflags=flags)
            output.seek(0)
            text = output.read().decode('utf-8', errors='replace')
        if (expected == 0 and result.returncode != 0) or (expected != 0 and result.returncode == 0):
            raise RuntimeError(text)
        return text

    def url(database):
        return f'postgresql://postgres@127.0.0.1:{port}/{database}?schema=public'

    # Use PostgreSQL's bundled client library; no Python database dependency needed.
    dll_directory = os.add_dll_directory(str(binaries)) if os.name == 'nt' else None
    pq = ctypes.CDLL(str(binaries / 'libpq.dll') if os.name == 'nt' else ctypes.util.find_library('pq'))
    for name, restype, argtypes in [
        ('PQconnectdb', ctypes.c_void_p, [ctypes.c_char_p]),
        ('PQstatus', ctypes.c_int, [ctypes.c_void_p]),
        ('PQerrorMessage', ctypes.c_char_p, [ctypes.c_void_p]),
        ('PQexec', ctypes.c_void_p, [ctypes.c_void_p, ctypes.c_char_p]),
        ('PQresultStatus', ctypes.c_int, [ctypes.c_void_p]),
        ('PQresultErrorMessage', ctypes.c_char_p, [ctypes.c_void_p]),
        ('PQntuples', ctypes.c_int, [ctypes.c_void_p]),
        ('PQgetvalue', ctypes.c_char_p, [ctypes.c_void_p, ctypes.c_int, ctypes.c_int]),
        ('PQclear', None, [ctypes.c_void_p]), ('PQfinish', None, [ctypes.c_void_p])
    ]:
        function = getattr(pq, name)
        function.restype, function.argtypes = restype, argtypes

    def sql(database, statement=None, file=None):
        connection = pq.PQconnectdb(f'host=127.0.0.1 port={port} user=postgres dbname={database} connect_timeout=5'.encode())
        result = None
        try:
            if pq.PQstatus(connection) != 0:
                raise RuntimeError(pq.PQerrorMessage(connection).decode())
            text = Path(file).read_text() if file else statement
            result = pq.PQexec(connection, text.encode())
            if not result or pq.PQresultStatus(result) not in (1, 2):
                raise RuntimeError(pq.PQresultErrorMessage(result).decode() if result else 'No SQL result')
            return '\n'.join(pq.PQgetvalue(result, row, 0).decode() for row in range(pq.PQntuples(result)))
        finally:
            if result: pq.PQclear(result)
            pq.PQfinish(connection)

    def prisma(database, *arguments, expected=0):
        env = {**base_env, 'DATABASE_URL': url(database)}
        return run([node, cli, *arguments], env, expected)

    started = False
    try:
        run([programs['initdb'], '-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--no-locale'])
        run([programs['pg_ctl'], '-D', data, '-l', workspace / 'postgres.log', '-o', f'-h 127.0.0.1 -p {port}', '-w', 'start'])
        started = True
        print(sql('postgres', 'SHOW server_version;').strip())
        for database in ['clean_test', 'legacy_empty_test', 'legacy_rows_test']:
            sql('postgres', f'CREATE DATABASE {database};')
        prisma('clean_test', 'validate', '--schema', SCHEMA)
        prisma('clean_test', 'migrate', 'deploy', '--schema', SCHEMA)
        prisma('clean_test', 'migrate', 'deploy', '--schema', SCHEMA)
        prisma('clean_test', 'migrate', 'status', '--schema', SCHEMA)
        prisma('clean_test', 'migrate', 'diff', '--from-url', url('clean_test'), '--to-schema-datamodel', SCHEMA, '--exit-code')
        assert sql('clean_test', 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;').strip() == str(len(list(MIGRATIONS.glob('*/migration.sql'))))
        sql('clean_test', file=SCHEMA.parent / 'verify_contract.sql')
        assert sql('clean_test', 'SELECT count(*) FROM "Mission";').strip() == '0'
        sql('clean_test', file=SCHEMA.parent / 'verify_query_plan.sql')
        print('PASS: alert list uses chronological index without sorting')
        print('PASS: fresh deploy, repeat deploy, schema drift, constraints and test rollback')
        for database in ['legacy_empty_test', 'legacy_rows_test']:
            sql(database, file=MIGRATIONS / '20260920000100_baseline/migration.sql')
            prisma(database, 'migrate', 'resolve', '--applied', '20260920000100_baseline', '--schema', SCHEMA)
        prisma('legacy_empty_test', 'migrate', 'deploy', '--schema', SCHEMA)
        sql('legacy_empty_test', file=SCHEMA.parent / 'verify_contract.sql')
        print('PASS: existing empty database baseline and upgrade')
        sql('legacy_rows_test', """INSERT INTO "MissionTelemetry" ("id", "source", "category", "payload") VALUES ('preserve-me', 'iss', 'orbit', '{"original":true}');""")
        try:
            sql('legacy_rows_test', file=MIGRATIONS / '20260920000200_backend_contract/migration.sql')
            raise AssertionError('Expected legacy-data guard to reject populated tables')
        except RuntimeError as error:
            assert 'Legacy rows require' in str(error), str(error)
        output = prisma('legacy_rows_test', 'migrate', 'deploy', '--schema', SCHEMA, expected=1)
        # Prisma 5 may report the aborted transaction rather than the original guard error.
        assert 'Legacy rows require' in output or 'current transaction is aborted' in output, output
        assert sql('legacy_rows_test', """SELECT "payload"->>'original' FROM "MissionTelemetry" WHERE "id"='preserve-me';""").strip() == 'true'
        assert sql('legacy_rows_test', "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='Mission';").strip() == '0'
        assert sql('legacy_rows_test', "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='MissionTelemetry' AND column_name='mission';").strip() == '0'
        print('PASS: populated legacy database rejected without data loss or partial schema changes')
    finally:
        if started:
            run([programs['pg_ctl'], '-D', data, '-m', 'immediate', '-w', 'stop'])
        print(f'Test cluster stopped; diagnostic files retained at {workspace}')


if __name__ == '__main__':
    main()
