"""Integration tests: reject-absolute-internal-links.sh."""
import os
import subprocess
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "..", "reject-absolute-internal-links.sh")
FIXTURE = os.path.join(HERE, "fixtures", "absolute-internal-link")
REPO_ROOT = os.path.join(HERE, "..", "..")


class RejectAbsoluteInternalLinksTest(unittest.TestCase):
    def run_script(self, root):
        proc = subprocess.run(
            ["bash", SCRIPT, root],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return proc

    def test_fails_on_fixture_with_bad_link(self):
        proc = self.run_script(FIXTURE)
        self.assertEqual(proc.returncode, 1, proc.stdout + proc.stderr)
        self.assertIn("queerglobal.com", proc.stderr)

    def test_passes_on_published_site_tree(self):
        proc = self.run_script(REPO_ROOT)
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("ok:", proc.stderr)


if __name__ == "__main__":
    unittest.main()
