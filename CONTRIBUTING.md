# Contributing to Real-time Voting App

Thank you for your interest in contributing to the Real-time Voting App! We welcome contributions from the community.

## 🚀 Quick Start for Contributors

### Prerequisites

- Node.js 18+ and npm
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) for Cloudflare Workers
- A Cloudflare account (free tier is sufficient)

### Development Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/realtime-voting-app.git
   cd realtime-voting-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Configure Wrangler**:
   ```bash
   cp wrangler.example.jsonc wrangler.jsonc
   # Edit wrangler.jsonc with your settings
   ```

5. **Create R2 bucket**:
   ```bash
   wrangler r2 bucket create survey-qr-codes
   ```

6. **Start local development**:
   ```bash
   npm run dev
   ```

## 🎯 How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/YOUR_USERNAME/realtime-voting-app/issues)
2. If not, create a new issue using the bug report template
3. Include:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (browser, OS, etc.)

### Suggesting Features

1. Check existing [GitHub Issues](https://github.com/YOUR_USERNAME/realtime-voting-app/issues) for similar suggestions
2. Create a new issue using the feature request template
3. Explain:
   - The use case for the feature
   - Why it would be valuable
   - Potential implementation approach

### Code Contributions

1. **Fork the repository** and create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards:
   - Write TypeScript for all new code
   - Follow existing code style and patterns
   - Add comments for complex logic
   - Keep functions small and focused

3. **Test your changes**:
   ```bash
   # Start local development server
   npm run dev

   # Test in browser at http://localhost:8787
   # Verify WebSocket connections work
   # Test voting functionality
   # Test QR code generation
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   Use conventional commit format:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `style:` for formatting changes
   - `refactor:` for code refactoring
   - `test:` for adding tests

5. **Push and create a Pull Request**:
   ```bash
   git push origin feature/your-feature-name
   ```

## 📝 Coding Standards

### TypeScript Guidelines

- Use strict TypeScript types
- Define interfaces for all data structures
- Avoid `any` type unless absolutely necessary
- Use meaningful variable and function names

### Code Style

- Use 2 spaces for indentation
- Use semicolons
- Use double quotes for strings
- Maximum line length: 100 characters
- Use meaningful comments for complex logic

### Cloudflare Workers Best Practices

- Keep cold start time minimal
- Use proper error handling
- Implement appropriate security headers
- Follow Cloudflare Workers limits and quotas
- Use WebSocket Hibernation API for Durable Objects

## 🏗️ Architecture Overview

```
├── src/
│   └── index.ts          # Main Worker code + Durable Object
├── public/
│   ├── index.html        # Voting interface
│   └── results.html      # Results display
├── wrangler.jsonc        # Cloudflare Workers configuration
└── package.json          # Dependencies and scripts
```

### Key Components

- **Main Worker**: Handles HTTP requests and serves static assets
- **SurveyManager Durable Object**: Manages survey state and WebSocket connections
- **R2 Storage**: Stores generated QR codes
- **WebSocket Connections**: Real-time updates to all connected clients

## 🧪 Testing

### Manual Testing Checklist

- [ ] Voting page loads correctly
- [ ] Can select multiple options
- [ ] Vote submission works
- [ ] Duplicate voting is prevented
- [ ] Real-time updates appear
- [ ] QR code generation works
- [ ] Results page displays correctly
- [ ] Survey reset functionality works
- [ ] WebSocket reconnection works

### Test with Multiple Users

```bash
# Use the simulate-votes.js script for testing
node simulate-votes.js
```

## 📚 Documentation

When adding new features:

1. Update the README.md if user-facing
2. Add inline code comments
3. Update TypeScript interfaces
4. Document any new configuration options

## 🚀 Deployment Testing

Before submitting PRs that affect deployment:

1. Test with `wrangler dev`
2. Deploy to a test environment: `wrangler deploy`
3. Verify all functionality works in production
4. Test with real mobile devices using QR codes

## 🌟 Areas for Contribution

We especially welcome contributions in these areas:

### Easy (Good First Issues)
- UI/UX improvements
- Additional styling themes
- Better mobile responsiveness
- Documentation improvements

### Medium
- Additional survey question types
- Export functionality for results
- Admin dashboard improvements
- Performance optimizations

### Advanced
- Multi-survey support
- User authentication
- Analytics and reporting
- Advanced rate limiting

## 💡 Feature Ideas

- [ ] Dark mode toggle
- [ ] Custom survey branding
- [ ] Time-based voting windows
- [ ] Vote result exports (CSV, JSON)
- [ ] Multiple concurrent surveys
- [ ] User registration/authentication
- [ ] Advanced analytics dashboard
- [ ] Integration with external APIs
- [ ] Mobile app companion
- [ ] Accessibility improvements

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Discord**: (Add community Discord if available)

## 📋 Pull Request Process

1. Ensure your PR has a clear title and description
2. Reference any related issues
3. Include screenshots for UI changes
4. Verify all tests pass
5. Update documentation as needed
6. Be responsive to review feedback

## 🎉 Recognition

Contributors will be:
- Listed in the project README
- Mentioned in release notes
- Given credit in commit messages

Thank you for helping make this project better! 🚀