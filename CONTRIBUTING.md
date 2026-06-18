# Contributing to Nova Store

Thank you for contributing to Nova Store! Please follow these guidelines to ensure a smooth development process.

## Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase / PostgreSQL instance
- Redis instance

### Installation
1. Clone the repository.
2. Navigate to the backend directory:
   ```bash
   cd Backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up environment variables:
   Copy `.env.example` to `.env` and fill in the configuration options.

5. Run database setup:
   ```bash
   npm run db:setup
   ```

## Development Guidelines

### Code Style
- We enforce code styling rules via the `.editorconfig` file.
- Keep components focused and modular.
- Avoid deprecated tables (such as `admins`); use the `users` table and RBAC mappings.

### Commit Messages
- Use clear, descriptive commit messages.
- Prefix with area of change (e.g. `feat(auth): add CSRF token endpoint` or `fix(tests): resolve invitation service type mismatch`).

## Testing
Always make sure the test suites pass before submitting a pull request.

### Running Tests
- **All Tests**: `npm run test`
- **Unit Tests**: `npm run test:unit`
- **Integration Tests**: `npm run test:integration`
- **Watch mode**: `npm run test:watch`
- **Coverage report**: `npm run test:coverage`
