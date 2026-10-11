import os
import signal
import subprocess
import threading
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from ..models import Algorithm, AlgorithmToken

# Exit codes defined by cryptexVM/src/main.zig
EXIT_MESSAGES = {
    1: 'The VM could not start (missing user credentials).',
    65: 'Runtime error while executing the algorithm.',
    75: 'Compile error: the generated code is not valid.',
}

# Running VM processes, keyed by algorithm id. Only valid within this server process.
_processes = {}
_lock = threading.Lock()


class AlgorithmRunnerError(Exception):
    pass


def _work_dir():
    path = Path(settings.ALGORITHM_WORK_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _log_tail(algorithm, limit=2000):
    try:
        text = (_work_dir() / f'{algorithm.id}.log').read_text(errors='replace').strip()
    except OSError:
        return ''
    return text[-limit:]


def _revoke_token(algorithm):
    if algorithm.algorithm_token_id:
        AlgorithmToken.objects.filter(id=algorithm.algorithm_token_id).update(is_active=False)


def _finish(algorithm, returncode):
    if returncode in (0, -signal.SIGTERM, -signal.SIGKILL) or algorithm.status == Algorithm.STOPPED:
        algorithm.status = Algorithm.STOPPED
        algorithm.error_message = None
    else:
        algorithm.status = Algorithm.ERROR
        message = EXIT_MESSAGES.get(returncode, f'The VM exited with code {returncode}.')
        details = _log_tail(algorithm)
        algorithm.error_message = f'{message}\n\n{details}' if details else message

    algorithm.end_time = algorithm.end_time or timezone.now()
    algorithm.pid = None
    algorithm.save()
    _revoke_token(algorithm)


def refresh(algorithm):
    """Bring the stored status in line with the real VM process."""
    if algorithm.status not in (Algorithm.RUNNING, Algorithm.PAUSED):
        return algorithm

    with _lock:
        process = _processes.get(algorithm.id)
        if process is None:
            # The server restarted since this algorithm was launched
            algorithm.status = Algorithm.STOPPED
            algorithm.end_time = algorithm.end_time or timezone.now()
            algorithm.pid = None
            algorithm.save()
            _revoke_token(algorithm)
            return algorithm

        returncode = process.poll()
        if returncode is not None:
            _processes.pop(algorithm.id, None)
            _finish(algorithm, returncode)

    return algorithm


def latest_for(user):
    algorithm = Algorithm.objects.filter(owner=user).first()
    return refresh(algorithm) if algorithm else None


def start(user, source, blocks_json):
    vm_path = settings.CRYPTEX_VM_PATH
    if not os.path.isfile(vm_path):
        raise AlgorithmRunnerError(
            f'CryptexVM binary not found at {vm_path}. Make sure the cryptexvm service has run.'
        )

    current = latest_for(user)
    if current and current.status in (Algorithm.RUNNING, Algorithm.PAUSED):
        stop(current)

    token = AlgorithmToken(user=user, name='algorithm run')
    raw_key = AlgorithmToken.generate_key()
    token.set_key(raw_key)
    token.save()

    algorithm = Algorithm.objects.create(
        owner=user,
        status=Algorithm.RUNNING,
        stored_state={'blocks_json': blocks_json, 'source': source},
        algorithm_token_id=token.id,
    )

    work_dir = _work_dir()
    source_path = work_dir / f'{algorithm.id}.ctx'
    source_path.write_text(source)
    log_file = open(work_dir / f'{algorithm.id}.log', 'w')

    env = {
        'PATH': os.environ.get('PATH', ''),
        'USER_ID': str(user.id),
        'AUTH_TOKEN': raw_key,
    }
    try:
        process = subprocess.Popen(
            [vm_path, str(source_path)],
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            cwd=work_dir,
        )
    except OSError as e:
        algorithm.status = Algorithm.ERROR
        algorithm.error_message = f'Failed to launch the VM: {e}'
        algorithm.end_time = timezone.now()
        algorithm.save()
        token.is_active = False
        token.save(update_fields=['is_active'])
        raise AlgorithmRunnerError(algorithm.error_message)
    finally:
        log_file.close()

    with _lock:
        _processes[algorithm.id] = process

    algorithm.pid = process.pid
    algorithm.save(update_fields=['pid'])
    return algorithm


def toggle_pause(algorithm):
    """Pause a running algorithm or resume a paused one. Returns the new status."""
    with _lock:
        process = _processes.get(algorithm.id)
    if process is None or process.poll() is not None:
        raise AlgorithmRunnerError('Algorithm is not running.')

    if algorithm.status == Algorithm.RUNNING:
        process.send_signal(signal.SIGSTOP)
        algorithm.status = Algorithm.PAUSED
    else:
        process.send_signal(signal.SIGCONT)
        algorithm.status = Algorithm.RUNNING
    algorithm.save(update_fields=['status'])
    return algorithm.status


def stop(algorithm):
    with _lock:
        process = _processes.pop(algorithm.id, None)

    algorithm.status = Algorithm.STOPPED
    algorithm.end_time = timezone.now()

    if process is not None and process.poll() is None:
        process.send_signal(signal.SIGCONT)
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()

    _finish(algorithm, 0)
    return algorithm
