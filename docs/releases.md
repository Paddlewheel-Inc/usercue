# Merging changes and publishing updates

## Merge a pull request

1. Add a short entry under `Unreleased` in `CHANGELOG.md` for user-facing changes. Include any required configuration changes or migration instructions.
2. Open a pull request against `main` and wait for review and passing CI checks.
3. Merge the pull request. Merging alone does not publish an image; a version bump is only needed when preparing a release.

## Publish an update

1. Create a release branch from the latest `main`.
2. Choose the next version: patch (`1.0.1`) for fixes, minor (`1.1.0`) for compatible features, or major (`2.0.0`) for breaking changes.
3. Run `bun run version:prepare 1.0.1`, substituting your chosen version. This updates `package.json` and moves the unreleased changelog entries into that version.
4. Run the checks below, then commit the version and changelog changes, open a pull request, and merge after CI passes.

   ```sh
   bun run version:check
   bun run test:release
   bun run typecheck
   bun run lint
   bun run build
   ```

5. In GitHub Releases, create a release with the matching tag (for example, `v1.0.1`) targeting the merged release commit. Copy its changelog entries into the release notes and publish.
6. Check that **Actions → Release image** succeeds. The image is available as `ghcr.io/paddlewheel-inc/usercue:v1.0.1`.

For the first release, use the already prepared `1.0.0` version and start at step 4.
For a release candidate, use a version such as `1.1.0-rc.1` and mark the GitHub release as a prerelease.

Stable releases advance `latest`; release candidates and older versions do not. Publishing does not update deployed instances.

To publish an existing tag manually or retry publication, use **Actions → Release image → Run workflow** on `main` and enter the tag. Never move a published tag or reuse its version for different code.
