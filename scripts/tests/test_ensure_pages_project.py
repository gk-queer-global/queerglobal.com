"""Integration tests: run ensure-pages-project.sh against a fake Cloudflare API."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "ensure-pages-project.sh")
FAKE = os.path.join(HERE, "fake_cloudflare.py")


class EnsurePagesProjectTest(unittest.TestCase):
    def run_script(self, state=None, token="t", project="queerglobal-grandkru"):
        log = tempfile.NamedTemporaryFile(delete=False, suffix=".jsonl")
        log.close()
        self.addCleanup(os.unlink, log.name)
        fake = subprocess.Popen(
            [sys.executable, "-I", FAKE],
            stdout=subprocess.PIPE,
            text=True,
            env=dict(
                os.environ,
                FAKE_STATE=json.dumps(state or {}),
                FAKE_TOKEN="t",
                FAKE_LOG=log.name,
            ),
        )
        port = fake.stdout.readline().strip()
        fake.stdout.close()
        self.addCleanup(fake.wait)
        self.addCleanup(fake.kill)
        env = {k: v for k, v in os.environ.items() if not k.lower().endswith("_proxy")}
        env.update(
            CLOUDFLARE_API_TOKEN=token,
            CLOUDFLARE_ACCOUNT_ID="acct",
            CLOUDFLARE_API_URL=f"http://127.0.0.1:{port}/client/v4",
        )
        proc = subprocess.run(
            ["bash", SCRIPT, project],
            capture_output=True,
            text=True,
            env=env,
            timeout=30,
        )
        return proc

    def test_succeeds_when_project_exists(self):
        proc = self.run_script({"projects": {"queerglobal-grandkru": {"production_branch": "main"}}})
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("verified", proc.stdout)

    def test_fails_when_project_missing(self):
        proc = self.run_script({"projects": {}})
        self.assertEqual(proc.returncode, 1)
        self.assertIn("does not exist", proc.stderr)

    def test_bad_token_fails(self):
        proc = self.run_script(
            {"projects": {"queerglobal-grandkru": {}}},
            token="wrong",
        )
        self.assertEqual(proc.returncode, 1)


if __name__ == "__main__":
    unittest.main()
