import base64
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / "tools/journals/sync_journals.py"
SPEC = importlib.util.spec_from_file_location("journal_sync", SCRIPT)
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)
REVISION = "a" * 40
CONTENT = {name: "# Journal\n\nAn evidence-based journal with enough content.\n" for name in sync.FILES}


class FakeDestination:
    def __init__(self, private=True, conflict=False, old=None):
        self.private = private
        self.conflict = conflict
        self.old = old
        self.writes = []

    def request(self, method, path, body=None):
        if method != "GET":
            self.writes.append((method, path, body))
        if method == "GET" and path == "repos/owner/journals":
            return {"private": self.private, "default_branch": "main"}
        if "/git/ref/heads/" in path:
            return {"object": {"sha": "head"}}
        if "/contents/" in path:
            if self.old is None:
                raise sync.ApiError(404, method, path)
            return {"content": base64.b64encode(json.dumps(self.old).encode()).decode()}
        if "/git/commits/head" in path:
            return {"tree": {"sha": "parent-tree"}}
        if path.endswith("/git/trees"):
            return {"sha": "new-tree"}
        if method == "POST" and path.endswith("/git/commits"):
            return {"sha": "new-commit"}
        if method == "PATCH":
            if self.conflict:
                self.conflict = False
                raise sync.ApiError(422, method, path)
            return {}
        raise AssertionError((method, path))


class JournalTests(unittest.TestCase):
    def manifest(self):
        return sync.snapshot(CONTENT, "Metic99", "owner/Metic99", "master", REVISION, "2026-11-08")

    def test_missing_or_non_text_journal_is_rejected(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get("JOURNAL_TEST_TMP")) as temp:
            root = Path(temp)
            for name, value in CONTENT.items():
                (root / name).write_text(value, encoding="utf-8")
            (root / "PROJECT_STATE.md").unlink()
            with self.assertRaises(sync.SyncError):
                sync.read_journals(root)
            (root / "PROJECT_STATE.md").write_bytes(b"\xff")
            with self.assertRaises(sync.SyncError):
                sync.read_journals(root)

    def test_symlink_is_rejected_without_following_it(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get("JOURNAL_TEST_TMP")) as temp:
            with patch.object(Path, "is_symlink", return_value=True):
                with self.assertRaises(sync.SyncError):
                    sync.read_journals(Path(temp))

    def test_public_destination_gets_no_write(self):
        remote = FakeDestination(private=False)
        with self.assertRaises(sync.SyncError):
            sync.publish(remote, None, "owner/journals", CONTENT, self.manifest())
        self.assertEqual(remote.writes, [])

    def test_stale_source_gets_no_write(self):
        remote = FakeDestination()
        with patch.object(sync, "latest_source", return_value=False):
            sync.publish(remote, None, "owner/journals", CONTENT, self.manifest())
        self.assertEqual(remote.writes, [])

    def test_repeat_snapshot_does_not_make_a_commit(self):
        manifest = self.manifest()
        remote = FakeDestination(old=manifest)
        with patch.object(sync, "latest_source", return_value=True):
            sync.publish(remote, None, "owner/journals", CONTENT, manifest)
        self.assertEqual(remote.writes, [])

    def test_conflict_retry_changes_only_the_project_journals(self):
        remote = FakeDestination(conflict=True)
        with patch.object(sync, "latest_source", return_value=True):
            sync.publish(remote, None, "owner/journals", CONTENT, self.manifest())
        trees = [body for method, path, body in remote.writes if path.endswith("/git/trees")]
        self.assertEqual(len(trees), 2)
        expected = {f"Metic99/{name}" for name in sync.FILES} | {"Metic99/sync-manifest.json"}
        for tree in trees:
            self.assertEqual({entry["path"] for entry in tree["tree"]}, expected)
            self.assertEqual(tree["base_tree"], "parent-tree")
        for method, path, body in remote.writes:
            if method == "PATCH":
                self.assertIs(body["force"], False)

    def test_pr_requires_state_update_for_code_changes(self):
        with patch.object(sync, "read_journals", return_value=CONTENT), \
                patch.object(sync, "has_commit", return_value=True), \
                patch.object(sync, "exempt_patterns", return_value=[]):
            with patch.object(sync, "git", side_effect=["", "", "src/game.ts"]):
                with self.assertRaises(sync.SyncError):
                    sync.check(Path("."), REVISION)

    def test_learning_records_are_exempt_but_code_is_not(self):
        with patch.object(sync, "read_journals", return_value=CONTENT), \
                patch.object(sync, "has_commit", return_value=True), \
                patch.object(sync, "exempt_patterns", return_value=["docs/learning/*"]):
            changed = "docs/learning/REVIEWS.md\ntools/journals/state-exempt.txt"
            with patch.object(sync, "git", side_effect=["", "", changed]):
                sync.check(Path("."), REVISION)
            with patch.object(sync, "git", side_effect=["", "", changed + "\nsrc/game.ts"]):
                with self.assertRaises(sync.SyncError):
                    sync.check(Path("."), REVISION)

    def test_exempt_file_ignores_comments_and_blanks(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get("JOURNAL_TEST_TMP")) as temp:
            root = Path(temp)
            (root / sync.tool_dir(root)).mkdir(parents=True)
            (root / sync.tool_dir(root) / "state-exempt.txt").write_text("# quiz records\n\ndocs/learning/*\n", encoding="utf-8")
            self.assertEqual(sync.exempt_patterns(root), ["docs/learning/*"])
            self.assertEqual(sync.exempt_patterns(root / "missing"), [])

    def test_unreachable_base_after_force_push_validates_files_only(self):
        with patch.object(sync, "read_journals", return_value=CONTENT), \
                patch.object(sync, "has_commit", return_value=False):
            with patch.object(sync, "git", side_effect=["", ""]):
                self.assertEqual(sync.check(Path("."), REVISION), CONTENT)

    def test_secrets_and_local_paths_are_rejected(self):
        samples = [
            "See C:" + "\\Users\\someone\\repo\\notes.txt",
            "See /" + "Users/someone/repo",
            "-----BEGIN RSA " + "PRIVATE KEY-----",
            "token ghp_" + "A" * 30,
            "key sb_secret_" + "b" * 20,
            "jwt eyJ" + "a" * 12 + ".eyJ" + "b" * 12 + ".sig",
        ]
        with tempfile.TemporaryDirectory(dir=os.environ.get("JOURNAL_TEST_TMP")) as temp:
            root = Path(temp)
            for sample in samples:
                for name, value in CONTENT.items():
                    (root / name).write_text(value, encoding="utf-8")
                (root / "PROJECT_STATE.md").write_text(CONTENT["PROJECT_STATE.md"] + sample + "\n", encoding="utf-8")
                with self.assertRaises(sync.SyncError, msg=sample):
                    sync.read_journals(root)
            (root / "PROJECT_STATE.md").write_text(
                CONTENT["PROJECT_STATE.md"] + "See `docs/GDD.md` and src/Users/Profile.cs\n", encoding="utf-8"
            )
            sync.read_journals(root)

    def test_tracked_but_uncommitted_journals_are_rejected(self):
        with patch.object(sync, "read_journals", return_value=CONTENT):
            with patch.object(sync, "git", side_effect=["", "PROJECT_STATE.md"]):
                with self.assertRaises(sync.SyncError):
                    sync.check(Path("."))


if __name__ == "__main__":
    unittest.main()
