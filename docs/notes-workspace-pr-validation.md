# Notes workspace PR validation

PR38 carries the quiet review rail and scoped Notes workspace changes from
`0fcee0a4521a102c2915229699abb8c2e5df657d` and
`b9d23a6c36fdd152029a7fa93ff97f160510b529`.

Before push, workspace typecheck, all 1,210 tests, package builds and the example
production build passed again. The immutable `.7` candidate package SHA256 values
still match their manifest. Changed tracked files passed `git diff --check` and
a credential/private-path pattern scan. Existing untracked evidence was preserved.

The first GitHub public-release preflight failed because the separate tarball
inspector's exact export map lacked the new `./notes` entry. The release validator
already recognized that entry. The inspector now recognizes the same explicit
types/import pair, retaining all other metadata, archive content and leakage
checks. Actual locally packed BlockNote contents pass inspection, and all 123
release-guard tests pass after the correction. No application runtime changed.

The `.7` package remains an immutable integration candidate. Its feature matrix,
host requirements, performance accounting and verification limits remain in
`notes-workspace-acceptance-matrix.md` and
`notes-candidate-0.3.0-notes.7-verification.md`. In particular, the synthetic example
does not restore Canvas drafts or persist tab layouts, and production host
integration and full legacy editing parity remain unfinished. No npm publication,
deployment, production data or credentials changes are included.
