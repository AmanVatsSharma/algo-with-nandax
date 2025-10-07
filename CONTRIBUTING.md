# Contributing to Algo with NandaX

Thank you for your interest in contributing to Algo with NandaX! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/algo-with-nandax.git
   cd algo-with-nandax
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/AmanVatsSharma/algo-with-nandax.git
   ```
4. **Install dependencies**:
   ```bash
   pnpm install
   ```

## Development Workflow

### 1. Create a Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes
- `chore/` - Maintenance tasks

### 2. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Keep commits focused and atomic

### 3. Commit Your Changes

We follow conventional commits:

```bash
git commit -m "feat: add new trading strategy"
git commit -m "fix: resolve order execution bug"
git commit -m "docs: update setup instructions"
```

Commit types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code style (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Tests
- `chore` - Maintenance

### 4. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Code Style

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow the existing ESLint configuration
- Use Prettier for formatting
- Add type annotations
- Avoid `any` types when possible

### Example:

```typescript
// Good
async function getStrategy(id: string): Promise<Strategy> {
  return this.strategyRepository.findOne({ where: { id } });
}

// Avoid
async function getStrategy(id: any): Promise<any> {
  return this.strategyRepository.findOne({ where: { id } });
}
```

### NestJS Conventions

- Use dependency injection
- Keep controllers thin
- Put business logic in services
- Use DTOs for validation
- Create specific exception filters

### React/Next.js Conventions

- Use functional components
- Prefer hooks over class components
- Use TypeScript interfaces for props
- Keep components small and focused
- Use proper naming (PascalCase for components)

## Testing

### Running Tests

```bash
# All tests
pnpm test

# API tests only
pnpm --filter @algo-nandax/api test

# With coverage
pnpm --filter @algo-nandax/api test:cov

# Watch mode
pnpm --filter @algo-nandax/api test:watch
```

### Writing Tests

- Write tests for all new features
- Maintain or improve code coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

Example:

```typescript
describe('StrategyService', () => {
  describe('create', () => {
    it('should create a new strategy', async () => {
      // Arrange
      const userId = 'user-123';
      const strategyData = { name: 'Test Strategy' };

      // Act
      const result = await service.create(userId, strategyData);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Strategy');
      expect(result.userId).toBe(userId);
    });
  });
});
```

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows the project style
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commit messages follow conventions
- [ ] No console.log statements left in code
- [ ] No commented-out code

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How the changes were tested

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No new warnings
```

## Documentation

- Update README.md for major changes
- Add comments for complex logic
- Update ARCHITECTURE.md for architectural changes
- Update API documentation for endpoint changes

## Reporting Bugs

### Before Reporting

1. Check existing issues
2. Try to reproduce on latest version
3. Collect relevant information

### Bug Report Template

```markdown
**Describe the bug**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen

**Screenshots**
If applicable, add screenshots

**Environment:**
 - OS: [e.g., macOS, Linux, Windows]
 - Node version: [e.g., 18.17.0]
 - pnpm version: [e.g., 8.10.0]

**Additional context**
Any other relevant information
```

## Feature Requests

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description of the problem

**Describe the solution you'd like**
Description of desired solution

**Describe alternatives considered**
Alternative solutions or features

**Additional context**
Any other relevant information
```

## Questions?

- Open a discussion on GitHub
- Check existing documentation
- Ask in our community channels

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- GitHub contributors page
- Release notes for significant contributions
- README.md (for major contributions)

Thank you for contributing to Algo with NandaX! 🚀
