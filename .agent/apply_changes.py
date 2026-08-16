#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
changelog_path = root / "CHANGELOG.md"
changelog = changelog_path.read_text(encoding="utf-8")
anchor = "- Added regression tests for strict encrypted-string validation and user-key length checks\n"
current = "- Frontend crypto regression tests and continuous integration groundwork\n"

if anchor not in changelog:
    if current not in changelog:
        raise SystemExit("Could not find changelog compatibility anchor")
    changelog = changelog.replace(current, current + anchor, 1)
    changelog_path.write_text(changelog, encoding="utf-8")

previous_script = subprocess.check_output(
    ["git", "show", "HEAD^:.agent/apply_changes.py"],
    cwd=root,
)
temporary_script = root / ".agent" / "previous_apply.py"
temporary_script.write_bytes(previous_script)

try:
    subprocess.run(
        [sys.executable, str(temporary_script)],
        cwd=root,
        check=True,
    )
finally:
    temporary_script.unlink(missing_ok=True)
