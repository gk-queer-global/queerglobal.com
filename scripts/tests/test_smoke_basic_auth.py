"""Integration tests: run smoke-basic-auth.sh against a fake gated site."""
import os
import subprocess
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "smoke-basic-auth.sh")
FAKE = os.path.join(HERE, "fake_basic_auth_site.py")


class SmokeBasicAuthTest(unittest.TestCase):
    def run_script(self, user, password):
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
        env = {k: v for k, v in os.environ.items() if not k.lower().endswith("_proxy")}
        env.update(BASIC_AUTH_USER=user, BASIC_AUTH_PASS=password, SMOKE_PATHS="/ /about/")
        proc = subprocess.run(
            ["bash", SCRIPT, f"http://127.0.0.1:{port}"],
            capture_output=True,
            text=True,
            env=env,
            timeout=30,
        )
        return proc

    def test_happy_path(self):
        proc = self.run_script("u", "p")
        self.assertEqual(proc.returncode, 0, proc.stderr + proc.stdout)

    def test_wrong_password_fails(self):
        fake = subprocess.Popen(
            [sys.executable, "-I", FAKE],
            stdout=subprocess.PIPE,
            text=True,
            env=dict(os.environ, TEST_USER="u", TEST_PASS="good"),
        )
        port = fake.stdout.readline().strip()
        fake.stdout.close()
        self.addCleanup(fake.wait)
        self.addCleanup(fake.kill)
        env = {k: v for k, v in os.environ.items() if not k.lower().endswith("_proxy")}
        env.update(BASIC_AUTH_USER="u", BASIC_AUTH_PASS="bad", SMOKE_PATHS="/")
        proc = subprocess.run(
            ["bash", SCRIPT, f"http://127.0.0.1:{port}"],
            capture_output=True,
            text=True,
            env=env,
            timeout=30,
        )
        self.assertNotEqual(proc.returncode, 0)


if __name__ == "__main__":
    unittest.main()
