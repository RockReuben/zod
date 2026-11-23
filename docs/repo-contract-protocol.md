# Repository Contract & Discovery Protocol

## 1. Plan Resolution Order
Stop at the first hit:
1. Path named in `CLAUDE.md`, `AGENTS.md`, `README`, or `CONTRIBUTING`.
2. `docs/plans/*.md`, `PLAN.md`, `docs/PLAN.md`, `docs/requirements*`, `docs/spec*`.
3. None found:
   - `diff-reviewer`: Do not invent requirements. Cap bugs at `Plausible` unless proven by test/repro. Mark requirement checks `not verifiable: no repo plan`. Recommend creating `docs/plans/repo-plan.md` from `docs/repo-plan.template.md`.
   - `test-maker`: Create draft `docs/plans/repo-plan.md` from `docs/repo-plan.template.md` using verified repo facts only, tagged `[proposed]`. Report prominently that human review is needed.

## 2. Contract Extraction
From the plan and process docs (`CLAUDE.md`/`AGENTS.md`/`CONTRIBUTING`), extract:
- Active work unit ID, definition, behavior contract, interfaces touched, and **Done when** check.
- Constant expectations tagged `[confirmed]` (binding requirements) or `[proposed]` (defaults: never fail a build on `[proposed]` alone; raise an Open Question).
- Open questions and backlog entries touching the unit.
- Process rules: commit format, protected artifacts, diagram sync rules, risk tiers.

## 3. Test Rig Discovery
Check plan `Tooling` section first, then `package.json`, `Makefile`, `pyproject.toml`, `Cargo.toml`, `go.mod`, CI config, and test directories. Record exact commands. Never guess a command.
