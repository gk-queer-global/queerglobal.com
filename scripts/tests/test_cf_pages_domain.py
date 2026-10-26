"""Integration tests: run cf-pages-domain.sh against a fake Cloudflare API."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "cf-pages-domain.sh")
FAKE = os.path.join(HERE, "fake_cloudflare.py")
HOST = "staging.app.example.com"


class CfPagesDomainTest(unittest.TestCase):
    def run_script(self, state=None, token="t", args=("app", HOST)):
        log = tempfile.NamedTemporaryFile(delete=False, suffix=".jsonl")
        log.close()
        self.addCleanup(os.unlink, log.name)
        fake = subprocess.Popen([sys.executable, "-I", FAKE], stdout=subprocess.PIPE, text=True,
                                env=dict(os.environ, FAKE_STATE=json.dumps(state or {}),
                                         FAKE_TOKEN="t", FAKE_LOG=log.name))
        port = fake.stdout.readline().strip()
        fake.stdout.close()
        self.addCleanup(fake.wait)
        self.addCleanup(fake.kill)
        env = {k: v for k, v in os.environ.items() if not k.lower().endswith("_proxy")}
        env.update(CLOUDFLARE_API_TOKEN=token, CLOUDFLARE_ACCOUNT_ID="acct",
                   CLOUDFLARE_ZONE_ID="zone", CLOUDFLARE_API_URL=f"http://127.0.0.1:{port}/client/v4")
        proc = subprocess.run(["bash", SCRIPT, *args], capture_output=True, text=True, env=env, timeout=30)
        with open(log.name) as f:
            calls = [json.loads(line) for line in f if line.strip()]
        return proc, calls

    def writes(self, calls):
        return [c for c in calls if c["method"] != "GET"]

    def test_fresh_creates_domain_and_cname(self):
        proc, calls = self.run_script()
        self.assertEqual(proc.returncode, 0, proc.stderr)
        w = self.writes(calls)
        self.assertEqual(len(w), 2)
        self.assertEqual(w[0]["path"], "/client/v4/accounts/acct/pages/projects/app/domains")
        self.assertEqual(w[0]["body"], {"name": HOST})
        self.assertEqual(w[1]["path"], "/client/v4/zones/zone/dns_records")
        self.assertEqual(w[1]["body"]["type"], "CNAME")
        self.assertEqual(w[1]["body"]["content"], "app.pages.dev")
        self.assertTrue(w[1]["body"]["proxied"])
        project_gets = [c for c in calls if c["method"] == "GET" and c["path"].endswith("/projects/app")]
        self.assertEqual(len(project_gets), 1)

    def test_cname_uses_api_subdomain_not_project_name(self):
        """Project name can differ from the pages.dev hostname (e.g. renamed projects)."""
        proc, calls = self.run_script(state={"subdomain": "actual-host.pages.dev"})
        self.assertEqual(proc.returncode, 0, proc.stderr)
        dns = [c for c in self.writes(calls) if "dns_records" in c["path"]][0]
        self.assertEqual(dns["body"]["content"], "actual-host.pages.dev")

    def test_missing_project_fails_loudly(self):
        proc, _ = self.run_script(state={"missing_project": True})
        self.assertEqual(proc.returncode, 1)
        self.assertIn('read pages project "app" failed', proc.stderr)

    def test_project_without_subdomain_fails(self):
        proc, _ = self.run_script(state={"subdomain": ""})
        self.assertEqual(proc.returncode, 1)
        self.assertIn("no subdomain", proc.stderr)

    def test_idempotent_when_everything_exists(self):
        state = {"domains": [HOST],
                 "records": [{"id": "r1", "type": "CNAME", "name": HOST, "content": "app.pages.dev"}]}
        proc, calls = self.run_script(state)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(self.writes(calls), [])
        self.assertIn("present", proc.stdout)

    def test_refuses_to_overwrite_foreign_record(self):
        state = {"domains": [HOST], "records": [{"id": "r1", "type": "A", "name": HOST, "content": "1.2.3.4"}]}
        proc, calls = self.run_script(state)
        self.assertEqual(proc.returncode, 1)
        self.assertIn("refusing to overwrite", proc.stderr)
        self.assertEqual(self.writes(calls), [])

    def test_api_error_on_add_domain_fails(self):
        proc, calls = self.run_script({"fail": "POST /client/v4/accounts"})
        self.assertEqual(proc.returncode, 1)
        self.assertIn("add pages domain failed", proc.stderr)
        self.assertFalse(any("dns_records" in c["path"] and c["method"] == "POST" for c in calls))

    def test_bad_token_fails(self):
        proc, _ = self.run_script(token="wrong")
        self.assertEqual(proc.returncode, 1)
        self.assertIn("Authentication error", proc.stderr)

    def test_usage(self):
        proc = subprocess.run(["bash", SCRIPT, "only-one"], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 64)

    def test_missing_zone(self):
        env = dict(os.environ, CLOUDFLARE_API_TOKEN="t", CLOUDFLARE_ACCOUNT_ID="a")
        env.pop("CLOUDFLARE_ZONE_ID", None)
        proc = subprocess.run(["bash", SCRIPT, "app", HOST], capture_output=True, text=True, env=env)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("CLOUDFLARE_ZONE_ID is required", proc.stderr)


if __name__ == "__main__":
    unittest.main()
