# CRX Extractor - Modular Architecture

A secure Chrome extension (CRX) file extractor built with Bun and TypeScript, now with a clean modular architecture.

## Project Structure

```
crx-extractor/
├── index.ts                    # Main entry point & exports
├── package.json
├── tsconfig.json
├── .gitignore
├── .prettierrc
├── .env.example               # Example environment variables
├── setup.sh                   # Setup script
├── clean.sh                   # Clean extracted files
├── README.md
├── _extensions/               # Extracted extensions (gitignored)
│   ├── <extension-name>/      # Individual extension directories
│   └── *.crx                  # Original CRX files
├── src/
│   ├── cli.ts                 # CLI interface
│   ├── config/
│   │   ├── constants.ts       # Magic numbers, URLs, etc.
│   │   ├── defaults.ts        # Default configuration
│   │   └── types.ts           # Config interfaces & enums
│   ├── core/
│   │   └── crx-extractor.ts   # Main extraction logic
│   ├── errors/
│   │   └── index.ts           # Custom error classes
│   ├── logger/
│   │   └── index.ts           # Logging with sanitization
│   ├── types/
│   │   └── index.ts           # Core TypeScript types
│   ├── utils/
│   │   └── path.ts            # Path manipulation utilities
│   └── validators/
│       ├── manifest.ts        # Chrome manifest validation
│       └── path.ts            # Path security validation
└── examples/
    ├── programmatic-usage.ts  # Library usage examples
    └── custom-config.ts       # Configuration examples
```

## Module Overview

### Core Modules

- **`core/crx-extractor.ts`**: Main extraction logic, coordinates all other modules
- **`cli.ts`**: Command-line interface and argument parsing

### Configuration

- **`config/constants.ts`**: CRX magic numbers, version constants, URLs
- **`config/defaults.ts`**: Default security settings and limits
- **`config/types.ts`**: TypeScript interfaces for configuration

### Utilities

- **`utils/path.ts`**: Bun-native path manipulation without external dependencies
- **`logger/`**: Structured logging with data sanitization
- **`errors/`**: Typed error classes for different failure scenarios

### Validators

- **`validators/path.ts`**: Prevents path traversal attacks
- **`validators/manifest.ts`**: Validates Chrome extension manifests

## Security Features

- **Path traversal protection**: All paths are validated to ensure they stay within allowed directories
- **ZIP bomb detection**: Checks compression ratios and file counts
- **File size and count limits**: Prevents resource exhaustion
- **Secure temporary file handling**: Atomic operations with cleanup
- **Input validation and sanitization**: All inputs are validated

### Path Security

By default, the extractor only allows writing files to the current working directory (where you run the command). This prevents malicious extensions from writing files to system directories. You can configure additional allowed paths in the configuration if needed.

## Installation & Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd crx-extractor

# Run the setup script (installs dependencies and creates directories)
bun run setup

# Or manually:
bun install
mkdir -p _extensions
```

## Usage

### As a CLI Tool

```bash
# Install dependencies
bun install

# Extract from Chrome Web Store
bun run index.ts nkbihfbeogaeaoehlefnkodbefgpgknn

# Extract local file
bun run index.ts ./extension.crx ./output-dir

# With debug logging
bun run index.ts extension-id --debug
```

**Note**: By default, extensions are saved to `_extensions/` directory (with underscore prefix) to keep them separate from source code.

### As a Library

```typescript
import { CRXExtractor, ExtractorConfig, LogLevel } from './crx-extractor';

const config: ExtractorConfig = {
  logLevel: LogLevel.DEBUG,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  // ... other options
};

const extractor = new CRXExtractor('extension-id-or-path', config);
await extractor.extract('./output-directory');
```

## Development

```bash
# Type checking
bun run typecheck

# Format code
bun run format

# Run with file watching
bun run dev

# Clean extracted extensions
bun run clean
```

## API Exports

The main `index.ts` exports:

- `CRXExtractor` - Main extractor class
- `ExtractorConfig` - Configuration interface
- `LogLevel` - Logging level enum
- `Logger` - Logger class
- Error classes: `CRXError`, `ValidationError`, `DownloadError`, `ExtractionError`, `SecurityError`

## Advanced Configuration

See `examples/custom-config.ts` for examples of different configurations:

```bash
# Development mode with debug logging
bun run examples/custom-config.ts dev <extension-id>

# Production mode with stricter limits
bun run examples/custom-config.ts prod <extension-id>

# Test mode using temp directory
bun run examples/custom-config.ts test <extension-id>
```

## Benefits of Modular Architecture

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Testability**: Individual modules can be tested in isolation
3. **Maintainability**: Changes to one module don't affect others
4. **Reusability**: Modules like Logger and PathUtils can be used in other projects
5. **Type Safety**: Clear interfaces between modules with TypeScript
6. **Security**: Validation and security checks are centralized and consistent

## Troubleshooting

### Security Error: "Path resolves outside allowed directories"

This error occurs when the extractor tries to write files outside the allowed directories. By default, only the current working directory (where you run the command) is allowed.

**Solutions:**
1. Run the command from the directory where you want the files extracted
2. Specify an output directory within the current directory: `bun run index.ts <id> ./output`
3. Configure additional allowed paths in the configuration:

```typescript
const config: ExtractorConfig = {
  ...DEFAULT_CONFIG,
  allowedOutputPaths: ['.', '/home/user/extensions', '/tmp']
};
```

## Default Directory Structure

By default, extensions are extracted to a `_extensions` directory in your project root:

```
your-project/
├── index.ts
├── src/
│   └── ... (source files)
└── _extensions/              # All extracted extensions go here
    ├── MetaMask/            # Extracted extension files
    ├── MetaMask.crx         # Original CRX file
    └── ... (other extensions)
```

This keeps extracted files separate from your source code, preventing any accidental modifications to your project files. The underscore prefix (`_`) is a common convention for generated/build directories and ensures they appear separately from source directories.

### Permission Issues

If you encounter permission errors when creating the `_extensions` directory, ensure you have write permissions in the current directory or run:

```bash
mkdir -p _extensions
chmod 755 _extensions
```

### Miscellaneous

generate llm.md

```sh
repomix --style markdown -o llm.md --no-file-summary --verbose
```

testing utils

```sh
bun test --reporter=junit --reporter-outfile=failures.txt

bun test 2>&1 | grep -E "(FAIL|Error|✗)"
```
