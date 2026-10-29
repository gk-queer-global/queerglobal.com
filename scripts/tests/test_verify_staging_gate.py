"""Integration tests: custom-host gate smoke against a fake 403-without-auth site."""
import json
import os
import subprocess
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "smoke-staging-custom-host.sh")
FAKE = os.path.join(HERE, "fake_edge_blocked_site.py")


class VerifyStagingGateIntegrationTest(unittest.TestCase):
    def start_fake(self, user="u", password="p"):
        fake = subprocess.Popen(
            [sys.executable, "-I", FAKE],
            stdout=subprocess.PIPE,
            text=True,
            env=dict(os.environ, TEST_USER=user, TEST_PASS=password),
        )
        port = fake.stdout.readline().strip()
        fake.stdout.close()
        self.addCleanup(fake.wait)
        self.addCleanup(fake.kill)
        return port

    def run_smoke(self, port, paths="/ /about/"):
        env = {k: v for k, v in os.environ.items() if not k.lower().endswith("_proxy")}
        env["SMOKE_PATHS"] = paths
        return subprocess.run(
            ["bash", SCRIPT, f"http://127.0.0.1:{port}"],
            capture_output=True,
            text=True,
            env=env,
            timeout=30,
        )

    def test_403_without_auth_passes_as_gated(self):
        port = self.start_fake()
        proc = self.run_smoke(port)
        self.assertEqual(proc.returncode, 0, proc.stderr + proc.stdout)
        logs = [json.loads(line) for line in proc.stderr.splitlines() if line.startswith("{")]
        self.assertTrue(logs)
        self.assertTrue(all(entry["ok"] for entry in logs))
        self.assertTrue(all(entry["status"] == 403 for entry in logs))

    def test_200_without_auth_fails(self):
        fake = subprocess.Popen(
            [sys.executable, "-I", os.path.join(HERE, "fake_ungated_site.py")],
            stdout=subprocess.PIPE,
            text=True,
        )
        port = fake.stdout.readline().strip()
        fake.stdout.close()
        self.addCleanup(fake.wait)
        self.addCleanup(fake.kill)
        proc = self.run_smoke(port, paths="/")
        self.assertNotEqual(proc.returncode, 0)


if __name__ == "__main__":
    unittest.main()
