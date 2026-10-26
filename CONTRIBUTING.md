# Contributing to PaperFlow

Thank you for your interest in contributing to PaperFlow!

## Development Principles
1. **100% Offline & Private**: No feature may introduce network requests, telemetry, or remote dependencies.
2. **Non-Destructive**: Every operation must write to a new target file or designated output. Never overwrite original files in-place.
3. **Rust Core Clean Boundaries**: Core PDF manipulation logic lives in `crates/paperflow-core` without GUI or framework dependencies.

## Local Workflow
```bash
# Build & check Rust crates
cargo check --workspace
cargo test --workspace

# Build React / TypeScript UI
cd app_shell
pnpm install
pnpm build
```

## Pull Request Guidelines
- Run `cargo fmt --all` and `cargo clippy --workspace -- -D warnings`.
- Add integration tests under `crates/paperflow-core/tests/` for any new PDF operations.
- Ensure all tests pass with `cargo test --workspace`.
