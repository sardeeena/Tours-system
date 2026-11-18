# Dependency security exception

## Current exception: picomatch ReDoS advisory

- Advisory: [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
- CVE: CVE-2026-112366
- Severity: High
- Affected package: `picomatch` through `4.0.7`
- Current affected dependency chain: Vite 8 -> `tinyglobby` / `fdir` -> `picomatch`; the React Vite plugin inherits the Vite finding.
- Scope: development/build dependencies only. These packages are marked `dev: true` in `package-lock.json`, and Vite is not part of the production runtime dependency tree.
- Production mitigation: Hostinger's build lifecycle prunes development dependencies after building; the production-only npm audit must remain clean.
- Build exposure: Vite is used as a build tool. The production application runs the bundled Express server, not the Vite development server. Do not expose the Vite development server publicly or accept untrusted glob patterns in build configuration.

The advisory currently provides no patched npm version of `picomatch`. Downgrading Vite to 6.2.7 is not a safe remediation: the current npm advisory database reports separate high-severity Vite advisories affecting that release. The project therefore retains the supported Vite 8 toolchain rather than trading one high-severity finding for another.

The audit policy allows only this exact advisory and only the five known development-tree entries (`@vitejs/plugin-react`, `fdir`, `picomatch`, `tinyglobby`, and `vite`). The CI verifier fails if the package set, severity totals, advisory URL, or development-only classification changes. All production dependencies are separately audited with `npm audit --omit=dev`.

## Review trigger

Remove this exception as soon as the upstream `picomatch` package publishes a release outside the affected range and the Vite dependency chain resolves to it. Re-run the full dependency audit, clean install, type-check, production build, and Hostinger lifecycle verification before removing this document and the CI allowlist.
