# Style Guide

## Core Principles

Code should be sparse, simple, poetic like haiku. Maximum meaning in minimum form.

## Modules

- ES6 imports only: `import x from "x"` not `require("x")`
- Use `.mjs` extension for standalone scripts or set `"type": "module"` in package.json
- Named exports preferred over default exports when multiple items
- Top-level await is fine

## Formatting

- No semicolons
- No curly braces for single-line conditionals
- Template literals for all string interpolation: `` `hi ${name}` `` not `'hi ' + name`
- Trailing commas in multi-line literals
- `const` by default, `let` only when mutation essential

## Control Flow

- No `else` statements - use early returns
- Fail fast and loud - never silently swallow errors
- No try/catch except at system boundaries

```javascript
// Good
const getStatus = (score) => {
  if (score >= 90) return "A"
  if (score >= 80) return "B"
  return "F"
}

// Bad
const getStatus = (score) => {
  if (score >= 90) {
    return "A"
  } else if (score >= 80) {
    return "B"
  } else {
    return "F"
  }
}
```

## Functions

- Arrow functions only: `const fn = () => {}` not `function fn() {}`
- Functional patterns over OOP: map/filter/reduce over loops
- One concept per file as default export when possible

```javascript
// Good
const add = (a, b) => a + b
const users = data.filter(u => u.active).map(u => u.name)

// Bad
function add(a, b) { return a + b; }
```

## Types (TypeScript)

- Minimal type annotations - let TypeScript infer
- Avoid ornate generics
- Don't use `?.` defensively - if a value should exist, let it throw

## Comments

- No comments unless explicitly requested
- Code should be self-documenting through good naming
- If you need a comment, the code isn't clear enough

## Version Control

- No AI attribution in commits
- No "Generated with Claude" or similar
