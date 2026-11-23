#!/usr/bin/env python3
"""
diagrams:check - Validate all Mermaid diagrams under docs/
Exits 0 if all diagrams are valid, 1 if any diagram has syntax errors.
"""
import subprocess
import sys
from pathlib import Path


def find_mermaid_files(root: Path) -> list[Path]:
    """Find all .md files under docs/ that contain mermaid code blocks."""
    mermaid_files = []
    for md_file in root.rglob("*.md"):
        try:
            content = md_file.read_text(encoding="utf-8")
            if "```mermaid" in content:
                mermaid_files.append(md_file)
        except Exception as e:
            print(f"Warning: Could not read {md_file}: {e}", file=sys.stderr)
    return mermaid_files


def validate_diagram(md_file: Path) -> tuple[bool, str]:
    """Validate a single markdown file containing mermaid diagram(s).
    Returns (success, error_message)."""
    import tempfile
    import os
    try:
        with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as tmp:
            tmp_path = tmp.name
        try:
            result = subprocess.run(
                ["mmdc", "-i", str(md_file), "-o", tmp_path],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode == 0:
                return True, ""
            else:
                return False, result.stderr.strip()
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    except subprocess.TimeoutExpired:
        return False, "Timeout (60s) validating diagram"
    except FileNotFoundError:
        return False, "mmdc not found. Install with: npm install -g @mermaid-js/mermaid-cli"
    except Exception as e:
        return False, str(e)


def main():
    docs_root = Path(__file__).parent.parent / "docs"
    if not docs_root.exists():
        print(f"Error: {docs_root} does not exist", file=sys.stderr)
        return 1

    mermaid_files = find_mermaid_files(docs_root)
    if not mermaid_files:
        print("No Mermaid diagrams found under docs/")
        return 0

    print(f"Found {len(mermaid_files)} file(s) with Mermaid diagrams:")
    all_ok = True
    for md_file in mermaid_files:
        rel_path = md_file.relative_to(Path.cwd())
        print(f"  Validating {rel_path}...", end=" ")
        ok, err = validate_diagram(md_file)
        if ok:
            print("OK")
        else:
            print("FAILED")
            print(f"    {err}")
            all_ok = False

    if all_ok:
        print("\n✅ All diagrams are valid")
        return 0
    else:
        print("\n❌ Some diagrams have syntax errors")
        return 1


if __name__ == "__main__":
    sys.exit(main())