"""Compile/run the Java backend with JAVA_HOME, PATH, or the project-local JDK."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess

SERVER = Path(__file__).resolve().parent


def java_tools():
    suffix = '.exe' if os.name == 'nt' else ''
    candidates = []
    if os.environ.get('JAVA_HOME'):
        candidates.append(Path(os.environ['JAVA_HOME']) / 'bin')
    compiler = shutil.which('javac')
    if compiler:
        candidates.append(Path(compiler).parent)
    candidates.extend(sorted((SERVER.parent / '.tools' / 'java').glob('*/bin')))
    for directory in candidates:
        java, javac = directory / ('java' + suffix), directory / ('javac' + suffix)
        if java.is_file() and javac.is_file():
            return str(java), str(javac)
    raise RuntimeError('JDK 17 or newer is required. Set JAVA_HOME or place a JDK in .tools/java.')


def compile_java(output):
    java, javac = java_tools()
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    subprocess.run([javac, '-encoding', 'UTF-8', '-d', str(output), str(SERVER / 'JavaBackend.java')], check=True)
    return java


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--build', action='store_true')
    parser.add_argument('--port', type=int, default=5002)
    args = parser.parse_args()
    output = SERVER / '.java-build'
    java = compile_java(output)
    if not args.build:
        process = subprocess.Popen([java, f'-Dastra.port={args.port}', f'-Dastra.dataDir={SERVER / "src" / "data-files"}', '-cp', str(output), 'JavaBackend'])
        try:
            raise SystemExit(process.wait())
        except KeyboardInterrupt:
            process.terminate()
            process.wait(timeout=10)
