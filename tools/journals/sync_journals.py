"""Check merged journals and mirror only those journals to a private GitHub repo.

No model calls, gameplay builds, source-repository writes, or visibility changes.
Publishing is opt-in; the default is a local validation with no network requests.
"""

import argparse
import base64
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

FILES = ("GAME_VISION.md", "PROJECT_STATE.md", "LEARNING_LOG.md")
PROJECTS = {"Futbolito3D", "Metic99", "ScooterBoy"}
MAX_BYTES = 256 * 1024
REPO = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")
SHA = re.compile(r"[0-9a-f]{40}")
EXEMPT_FILE = "tools/journals/state-exempt.txt"
INFRASTRUCTURE = {
    ".github/workflows/journal-check.yml",
    ".github/workflows/journal-sync.yml",
}
# Journals are mirrored off-repo: refuse obvious secrets and local paths.
# The match itself is never printed.
FORBIDDEN = (
    ("a local Windows user path", re.compile(r"\b[A-Za-z]:[/\x5c]+Users[/\x5c]", re.I)),
    ("a local home-directory path", re.compile(r"(?<![\w.])/(?:Users|home)/[^/\s]+/")),
    ("a private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("a GitHub token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})")),
    ("an API secret key", re.compile(r"\b(?:sk-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16})")),
    ("a JSON Web Token", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.")),
)


class SyncError(RuntimeError):
    pass


class ApiError(SyncError):
    def __init__(self, status, method, path):
        self.status = status
        super().__init__(f"GitHub HTTP {status} for {method} {path}")


def git(root, *args):
    result = subprocess.run(
        ["git", *args], cwd=root, capture_output=True, text=True, check=False
    )
    if result.returncode:
        raise SyncError("Git inspection failed; confirm the checkout and base revision.")
    return result.stdout.strip()


def read_journals(root):
    content = {}
    for name in FILES:
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise SyncError(f"{name} must be an ordinary file in the project root.")
        raw = path.read_bytes()
        if len(raw) > MAX_BYTES:
            raise SyncError(f"{name} exceeds the 256 KiB journal limit.")
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as error:
            raise SyncError(f"{name} must use UTF-8.") from error
        if not text.lstrip("\ufeff \t\r\n").startswith("#"):
            raise SyncError(f"{name} needs a Markdown title and substantive content.")
        if len(text.strip()) < 40:
            raise SyncError(f"{name} is too short to be a populated journal.")
        for label, pattern in FORBIDDEN:
            if pattern.search(text):
                raise SyncError(f"{name} appears to contain {label}; remove it before mirroring.")
        content[name] = text
    return content


def tool_dir(root):
    """This tool's folder relative to the repository (tools/journals or Tools/journals)."""
    here = Path(__file__).resolve().parent
    try:
        return here.relative_to(Path(root).resolve()).as_posix()
    except ValueError:
        return EXEMPT_FILE.rsplit("/", 1)[0]


def exempt_patterns(root):
    """Paths whose changes do not need a PROJECT_STATE.md update (e.g. quiz records)."""
    path = root / tool_dir(root) / "state-exempt.txt"
    if not path.is_file():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip() and not line.lstrip().startswith("#")]


def is_infrastructure(path, root=None):
    prefixes = {"tools/journals/", "tests/journals/"}
    if root is not None:
        prefixes.add(tool_dir(root) + "/")
    return any(path.startswith(prefix) for prefix in prefixes) or path in INFRASTRUCTURE


def has_commit(root, revision):
    result = subprocess.run(
        ["git", "cat-file", "-e", f"{revision}^{{commit}}"],
        cwd=root, capture_output=True, text=True, check=False,
    )
    return result.returncode == 0


def check(root, base=None):
    content = read_journals(root)
    git(root, "ls-files", "--error-unmatch", "--", *FILES)
    if git(root, "diff", "--name-only", "HEAD", "--", *FILES):
        raise SyncError("Commit the journal changes before validation or publishing.")
    if base:
        if not SHA.fullmatch(base):
            raise SyncError("The comparison base must be a full commit SHA.")
        if not has_commit(root, base):
            # A force-push leaves the previous tip unreachable; validate the files only.
            print(
                "Warning: comparison base is not in this history (force-push?); "
                "skipping the PROJECT_STATE.md coverage check.",
                file=sys.stderr,
            )
            return content
        changed = set(git(root, "diff", "--name-only", f"{base}...HEAD", "--").splitlines())
        exempt = exempt_patterns(root)
        relevant = {
            p for p in changed
            if p not in FILES
            and not is_infrastructure(p, root)
            and not any(fnmatch.fnmatchcase(p, pattern) for pattern in exempt)
        }
        if relevant and "PROJECT_STATE.md" not in changed:
            raise SyncError(
                "This change affects the project but does not update PROJECT_STATE.md."
            )
    return content


def snapshot(content, project, repository, branch, revision, commit_date):
    if project not in PROJECTS:
        raise SyncError("JOURNAL_PROJECT must identify one of the three approved projects.")
    if not REPO.fullmatch(repository or "") or not SHA.fullmatch(revision or ""):
        raise SyncError("A valid source repository and full commit SHA are required.")
    if repository.split("/")[1].casefold() != project.casefold():
        raise SyncError("Project name does not match the source repository.")
    manifest = {
        "schema_version": 1,
        "project": project,
        "source_repository": repository,
        "source_branch": branch,
        "source_revision": revision,
        "source_commit_date": commit_date,
        "exported_at_utc": datetime.now(timezone.utc).isoformat(),
        "verification_scope": "Journal file validation only; no gameplay tests run.",
        "sha256": {
            name: hashlib.sha256(content[name].encode("utf-8")).hexdigest()
            for name in FILES
        },
    }
    return manifest


class GitHub:
    def __init__(self, token):
        if not token:
            raise SyncError("Publishing needs the configured GitHub token.")
        self.token = token

    def request(self, method, path, body=None):
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = Request(
            f"https://api.github.com/{path}",
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
                "User-Agent": "indie-studio-journal-sync",
            },
        )
        try:
            with urlopen(request, timeout=30) as response:
                return json.load(response)
        except HTTPError as error:
            # Do not print request headers, credentials, or remote response bodies.
            raise ApiError(error.code, method, path) from None


def latest_source(source, manifest):
    repo = manifest["source_repository"]
    metadata = source.request("GET", f"repos/{repo}")
    if metadata["default_branch"] != manifest["source_branch"]:
        raise SyncError("Only the source repository's default branch may publish.")
    branch = quote(manifest["source_branch"], safe="")
    ref = source.request("GET", f"repos/{repo}/git/ref/heads/{branch}")
    return ref["object"]["sha"] == manifest["source_revision"]


def publish(destination, source, target, content, manifest):
    if not REPO.fullmatch(target or ""):
        raise SyncError("Set JOURNAL_REPOSITORY to an owner/repository destination.")
    if target.casefold() == manifest["source_repository"].casefold():
        raise SyncError("The destination must be a separate journal repository.")
    metadata = destination.request("GET", f"repos/{target}")
    if metadata.get("private") is not True:
        raise SyncError("Refusing to publish: the journal repository must be private.")
    branch = metadata.get("default_branch")
    if not branch:
        raise SyncError("Initialize the private journal repository with a README first.")
    prefix = manifest["project"]
    ref_path = f"repos/{target}/git/ref/heads/{quote(branch, safe='')}"
    for attempt in range(3):
        if not latest_source(source, manifest):
            return "Superseded by a newer source revision; nothing published."
        head = destination.request("GET", ref_path)["object"]["sha"]
        old_path = (
            f"repos/{target}/contents/{prefix}/sync-manifest.json?ref={head}"
        )
        try:
            old_file = destination.request("GET", old_path)
            old = json.loads(base64.b64decode(old_file["content"]).decode("utf-8"))
        except ApiError as error:
            if error.status != 404:
                raise
            old = {}
        if (
            old.get("source_revision") == manifest["source_revision"]
            and old.get("sha256") == manifest["sha256"]
        ):
            return "This source revision is already synchronized."
        parent = destination.request("GET", f"repos/{target}/git/commits/{head}")
        updates = dict(content)
        updates["sync-manifest.json"] = json.dumps(manifest, indent=2) + "\n"
        tree = destination.request(
            "POST",
            f"repos/{target}/git/trees",
            {
                "base_tree": parent["tree"]["sha"],
                "tree": [
                    {
                        "path": f"{prefix}/{name}",
                        "mode": "100644",
                        "type": "blob",
                        "content": text,
                    }
                    for name, text in updates.items()
                ],
            },
        )
        commit = destination.request(
            "POST",
            f"repos/{target}/git/commits",
            {
                "message": (
                    f"Sync {prefix} journals at "
                    f"{manifest['source_revision'][:12]}"
                ),
                "tree": tree["sha"],
                "parents": [head],
            },
        )
        if not latest_source(source, manifest):
            return "Superseded during export; destination branch was not updated."
        try:
            destination.request(
                "PATCH",
                f"repos/{target}/git/refs/heads/{quote(branch, safe='')}",
                {"sha": commit["sha"], "force": False},
            )
            return f"Synchronized {prefix} journals at {manifest['source_revision'][:12]}."
        except ApiError as error:
            # Another project may update the shared repository concurrently.
            # Retry on its latest tree; never force-push or overwrite other folders.
            if error.status not in (409, 422) or attempt == 2:
                raise
    raise SyncError("Could not update the journal repository.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("check", "sync"))
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--base")
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        content = check(root, args.base)
        if args.mode == "check":
            print("Journal files and PROJECT_STATE.md change coverage passed.")
            return 0
        revision = os.environ.get("GITHUB_SHA") or git(root, "rev-parse", "HEAD")
        if git(root, "rev-parse", "HEAD") != revision:
            raise SyncError("The checkout differs from the requested source revision.")
        repository = os.environ.get("GITHUB_REPOSITORY", "")
        branch = os.environ.get("GITHUB_REF_NAME") or git(root, "branch", "--show-current")
        manifest = snapshot(
            content,
            os.environ.get("JOURNAL_PROJECT", ""),
            repository,
            branch,
            revision,
            git(root, "show", "-s", "--format=%cI", revision),
        )
        if not args.publish:
            print(
                f"Dry run passed for {manifest['project']}: "
                "three journals and revision metadata; no network writes."
            )
            return 0
        message = publish(
            GitHub(os.environ.get("JOURNAL_DESTINATION_TOKEN")),
            GitHub(os.environ.get("GITHUB_TOKEN")),
            os.environ.get("JOURNAL_REPOSITORY", ""),
            content,
            manifest,
        )
        print(message)
        return 0
    except (SyncError, OSError, ValueError, KeyError) as error:
        print(f"Journal sync stopped: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
